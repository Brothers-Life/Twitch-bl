// bl-media.exe : lit la musique en cours via les contrôles média de Windows (Spotify, Deezer, YouTube Music, Apple Music,
// Tidal, navigateurs, VLC…) et écrit une ligne JSON par seconde. Lancé et lu par hub/lib/media.js.
// Commandes sur l'entrée standard : « toggle|play|pause|next|prev [identifiant d'appli] ».
// Compilé par outils/build_media.py avec le csc.exe fourni avec Windows.
using System;
using System.Collections.Generic;
using System.Text;
using System.Threading;
using Windows.Foundation;
using Windows.Media.Control;
using Windows.Storage.Streams;

static class BlMedia
{
    static readonly Dictionary<string, string> covers = new Dictionary<string, string>();

    // attend une opération Windows Runtime (sans dépendre des extensions .NET « AsTask »)
    static T Wait<T>(IAsyncOperation<T> op, int ms)
    {
        int waited = 0;
        while (op.Status == AsyncStatus.Started && waited < ms) { Thread.Sleep(10); waited += 10; }
        return op.Status == AsyncStatus.Completed ? op.GetResults() : default(T);
    }

    static void Main()
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        GlobalSystemMediaTransportControlsSessionManager mgr;
        try { mgr = Wait(GlobalSystemMediaTransportControlsSessionManager.RequestAsync(), 5000);
             if (mgr == null) throw new Exception("contrôles média indisponibles"); }
        catch (Exception e) { Console.WriteLine("{\"error\":" + Q(e.Message) + "}"); return; }

        new Thread(() =>
        {
            string line;
            while ((line = Console.ReadLine()) != null) { try { Command(mgr, line.Trim()); } catch { } }
            Environment.Exit(0);   // le Hub s'est arrêté
        }) { IsBackground = true }.Start();

        while (true)
        {
            try { Console.WriteLine(Snapshot(mgr)); }
            catch (Exception e) { Console.WriteLine("{\"error\":" + Q(e.Message) + "}"); }
            Console.Out.Flush();
            Thread.Sleep(1000);
        }
    }

    static void Command(GlobalSystemMediaTransportControlsSessionManager mgr, string line)
    {
        var parts = line.Split(new[] { ' ' }, 2);
        foreach (var s in mgr.GetSessions())
        {
            if (parts.Length > 1 && s.SourceAppUserModelId != parts[1]) continue;
            switch (parts[0])
            {
                case "toggle": Wait(s.TryTogglePlayPauseAsync(), 2000); break;
                case "play": Wait(s.TryPlayAsync(), 2000); break;
                case "pause": Wait(s.TryPauseAsync(), 2000); break;
                case "next": Wait(s.TrySkipNextAsync(), 2000); break;
                case "prev": Wait(s.TrySkipPreviousAsync(), 2000); break;
            }
            return;
        }
    }

    static string Snapshot(GlobalSystemMediaTransportControlsSessionManager mgr)
    {
        var sb = new StringBuilder("{\"sessions\":[");
        bool first = true;
        foreach (var s in mgr.GetSessions())
        {
            var p = Wait(s.TryGetMediaPropertiesAsync(), 2000);
            if (p == null || string.IsNullOrEmpty(p.Title)) continue;
            var info = s.GetPlaybackInfo();
            var tl = s.GetTimelineProperties();
            string key = s.SourceAppUserModelId + "|" + p.Title + "|" + p.Artist;
            if (!first) sb.Append(',');
            first = false;
            sb.Append("{\"app\":").Append(Q(s.SourceAppUserModelId))
              .Append(",\"title\":").Append(Q(p.Title))
              .Append(",\"artist\":").Append(Q(p.Artist))
              .Append(",\"album\":").Append(Q(p.AlbumTitle))
              .Append(",\"status\":").Append(Q(info.PlaybackStatus.ToString()))
              .Append(",\"position\":").Append(((int)tl.Position.TotalSeconds).ToString())
              .Append(",\"duration\":").Append(((int)tl.EndTime.TotalSeconds).ToString())
              .Append(",\"updated\":").Append(tl.LastUpdatedTime.ToUnixTimeMilliseconds().ToString())
              .Append(",\"cover\":").Append(Q(Cover(p, key)))
              .Append('}');
        }
        return sb.Append("]}").ToString();
    }

    // pochette en data URL, mise en cache par morceau
    static string Cover(GlobalSystemMediaTransportControlsSessionMediaProperties p, string key)
    {
        string url;
        if (covers.TryGetValue(key, out url)) return url;
        url = "";
        try
        {
            if (p.Thumbnail != null)
            {
                var stream = Wait(p.Thumbnail.OpenReadAsync(), 2000);
                if (stream != null && stream.Size > 0 && stream.Size < 3 * 1024 * 1024)
                {
                    var reader = new DataReader(stream.GetInputStreamAt(0));
                    uint n = Wait(reader.LoadAsync((uint)stream.Size), 2000);
                    var bytes = new byte[n];
                    reader.ReadBytes(bytes);
                    url = "data:" + (string.IsNullOrEmpty(stream.ContentType) ? "image/png" : stream.ContentType) + ";base64," + Convert.ToBase64String(bytes);
                }
            }
        }
        catch { }
        if (url.Length == 0) return url;          // pochette pas encore prête : on retentera à la prochaine lecture
        if (covers.Count > 30) covers.Clear();
        covers[key] = url;
        return url;
    }

    static string Q(string s)
    {
        if (s == null) return "\"\"";
        var sb = new StringBuilder("\"");
        foreach (char c in s)
        {
            if (c == '"') sb.Append("\\\"");
            else if (c == '\\') sb.Append("\\\\");
            else if (c < ' ') sb.Append("\\u").Append(((int)c).ToString("x4"));
            else sb.Append(c);
        }
        return sb.Append('"').ToString();
    }
}
