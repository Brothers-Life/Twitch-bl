// Installeur BL Studio (BL-Studio-Setup.exe) : installe ce qui manque (OBS, plugins Aitum, Node.js, Python + ffmpeg),
// télécharge la dernière version de BL Studio depuis GitHub, configure OBS puis l'ouvre.
// Relancé plus tard, il met BL Studio à jour sans toucher aux réglages, jetons, points, logo ni scènes.
// Compilé par outils/publier.py avec le csc.exe fourni avec Windows (C# 5, aucun outil à installer).
//   BL-Studio-Setup.exe --verifier   : teste tout (logiciels, téléchargements, configuration OBS dans un dossier d'essai) sans rien installer
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        // relancé en administrateur uniquement pour copier les plugins dans ProgramData
        if (args.Length == 2 && args[0] == "--plugins")
        {
            try { foreach (var zip in Directory.GetFiles(args[1], "*.zip")) Installer.Extract(zip, Installer.PluginDir, null); }
            catch { Environment.Exit(1); }
            return;
        }
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new SetupForm(args.Length > 0 && args[0] == "--verifier"));
    }
}

class SetupForm : Form
{
    static readonly Color Bg = Color.FromArgb(21, 22, 26), Panel = Color.FromArgb(31, 33, 39), Acc = Color.FromArgb(222, 148, 37),
        Hi = Color.FromArgb(250, 230, 100), Txt = Color.FromArgb(238, 240, 243), Mute = Color.FromArgb(154, 160, 171);
    readonly RichTextBox log = new RichTextBox();
    readonly ProgressBar bar = new ProgressBar();
    readonly Label step = new Label();
    readonly Button go = new Button(), quit = new Button();

    readonly bool verify;

    public SetupForm(bool verify)
    {
        this.verify = verify;
        try { File.Delete(Path.Combine(Path.GetTempPath(), verify ? "bl-studio-verification.txt" : "bl-studio-installation.txt")); } catch { }
        Text = verify ? "Vérification de BL Studio" : "Installation de BL Studio";
        ClientSize = new Size(620, 470);
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Bg; ForeColor = Txt;
        Font = new Font("Segoe UI", 9.5f);
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

        var stripe = new Panel { Left = 0, Top = 0, Width = 620, Height = 6 };
        stripe.Paint += (s, e) =>
        {
            e.Graphics.FillRectangle(new SolidBrush(Acc), 0, 0, 380, 6);
            e.Graphics.FillRectangle(new SolidBrush(Color.FromArgb(204, 67, 8)), 380, 0, 150, 6);
            e.Graphics.FillRectangle(new SolidBrush(Hi), 530, 0, 90, 6);
        };
        var title = new Label { Text = "BL Studio", Left = 24, Top = 22, AutoSize = true, Font = new Font("Bahnschrift SemiBold", 22f), ForeColor = Txt };
        var sub = new Label { Text = "Overlays, alertes, bot, chat unifié, mini-jeux et multistream Twitch / TikTok / YouTube.\r\n" +
            "Il ajoute ce qui manque (OBS, plugins Aitum, Node.js, Python, ffmpeg) et configure OBS.",
            Left = 26, Top = 66, Width = 570, Height = 40, ForeColor = Mute };
        step.SetBounds(26, 116, 570, 22); step.ForeColor = Hi; step.Text = "Prêt à installer.";
        bar.SetBounds(26, 140, 568, 10); bar.Maximum = 100;
        log.SetBounds(26, 162, 568, 240);
        log.ReadOnly = true; log.BorderStyle = BorderStyle.None; log.BackColor = Panel; log.ForeColor = Txt; log.Font = new Font("Segoe UI", 9f);
        go.Text = verify ? "Vérifier" : "Installer"; go.SetBounds(394, 418, 110, 34); Style(go, true);
        quit.Text = "Fermer"; quit.SetBounds(512, 418, 82, 34); Style(quit, false);
        go.Click += (s, e) => Start();
        quit.Click += (s, e) => Close();
        Controls.AddRange(new Control[] { stripe, title, sub, step, bar, log, go, quit });
        // mode vérification : démarre tout seul
        if (verify) Shown += (s, e) => Start();
        Log("Dossier d'installation : " + Installer.Dest);
        Log(verify ? "Mode vérification : rien n'est installé ni modifié. Compte rendu : %TEMP%\\bl-studio-verification.txt"
                   : "Clique sur « Installer ». Windows peut demander l'autorisation pour chaque logiciel installé.");
    }

    static void Style(Button b, bool primary)
    {
        b.FlatStyle = FlatStyle.Flat;
        b.FlatAppearance.BorderSize = primary ? 0 : 1;
        b.FlatAppearance.BorderColor = Color.FromArgb(60, 63, 72);
        b.BackColor = primary ? Acc : Panel;
        b.ForeColor = primary ? Color.FromArgb(26, 15, 5) : Txt;
        b.Font = new Font("Segoe UI Semibold", 10f);
        b.Cursor = Cursors.Hand;
    }

    void Log(string line) { Log(line, Txt); }
    void Log(string line, Color c)
    {
        if (InvokeRequired) { BeginInvoke(new Action(() => Log(line, c))); return; }
        log.SelectionStart = log.TextLength;
        log.SelectionColor = c;
        log.AppendText(line + "\r\n");
        log.ScrollToCaret();
        // compte rendu gardé dans %TEMP% (à envoyer en cas de souci)
        try { File.AppendAllText(Path.Combine(Path.GetTempPath(), verify ? "bl-studio-verification.txt" : "bl-studio-installation.txt"), line + "\r\n", Encoding.UTF8); } catch { }
    }

    void Start()
    {
        go.Enabled = false; quit.Enabled = false;
        var inst = new Installer { VerifyOnly = verify };
        inst.OnLog = l => Log(l);
        inst.OnOk = l => Log("✓ " + l, Color.FromArgb(60, 207, 110));
        inst.OnStep = (t, p) => BeginInvoke(new Action(() => { step.Text = t; bar.Value = Math.Min(100, p); Log(""); Log(t, Hi); }));
        inst.Ask = msg => (bool)Invoke(new Func<bool>(() =>
            MessageBox.Show(this, msg, "BL Studio", MessageBoxButtons.OKCancel, MessageBoxIcon.Information) == DialogResult.OK));
        new Thread(() =>
        {
            try
            {
                inst.Run();
                BeginInvoke(new Action(() => { step.Text = verify ? "Vérification terminée : tout est prêt pour l'installation." : "Installation terminée : OBS s'ouvre avec BL Studio."; bar.Value = 100; quit.Text = "Terminer"; quit.Enabled = true; }));
            }
            catch (Exception ex)
            {
                Log("✗ " + ex.Message, Color.FromArgb(229, 72, 77));
                BeginInvoke(new Action(() => { step.Text = "L'installation s'est arrêtée. Corrige le problème puis relance."; go.Text = "Réessayer"; go.Enabled = true; quit.Enabled = true; }));
            }
        }) { IsBackground = true }.Start();
    }
}

class Installer
{
    public const string Repo = "Brothers-Life/Twitch-bl";
    public static readonly string Dest = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "BLStudio");
    static readonly string ObsExe = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"obs-studio\bin\64bit\obs64.exe");
    static readonly string AppData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
    static readonly string ProgramData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
    // OBS (Windows) charge les plugins tiers depuis C:\ProgramData\obs-studio\plugins
    public static readonly string PluginDir = Path.Combine(ProgramData, @"obs-studio\plugins");
    public bool VerifyOnly;
    string python;   // « py » (lanceur) ou chemin d'un python.exe réel
    readonly string tmp = Path.Combine(Path.GetTempPath(), "bl-studio-" + Guid.NewGuid().ToString("N").Substring(0, 8));

    public Action<string> OnLog = delegate { }, OnOk = delegate { };
    public Action<string, int> OnStep = delegate { };
    public Func<string, bool> Ask = delegate { return true; };

    public void Run()
    {
        ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
        Directory.CreateDirectory(tmp);
        try
        {
            if (VerifyOnly) { Verify(); return; }
            Software();
            CloseObs();
            Plugins();
            BlStudio();
            ConfigureObs();
            Shortcuts();
            OnStep("Ouverture d'OBS", 100);
            Process.Start(new ProcessStartInfo(ObsExe, "--collection \"BL Studio\" --profile \"BL Studio\"") { WorkingDirectory = Path.GetDirectoryName(ObsExe) });
            OnLog("Dans le dock BL Studio : onglet Identité (logo, nom, réseaux), puis Connexions et Diffusion.");
            OnLog("Les prochaines mises à jour de BL Studio s'installeront toutes seules (jamais pendant un live).");
        }
        finally
        {
            try { Directory.Delete(tmp, true); } catch { }
        }
    }

    // ---------- 1. Logiciels ----------
    void Software()
    {
        OnStep("1/6  Logiciels nécessaires", 5);
        if (Which("winget") == null)
            throw new Exception("winget est introuvable : installe « Programme d'installation d'application » depuis le Microsoft Store, puis relance.");
        if (File.Exists(ObsExe)) OnOk("OBS Studio déjà installé"); else Winget("OBSProject.OBSStudio", "OBS Studio");
        if (Which("node") != null || File.Exists(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"nodejs\node.exe"))) OnOk("Node.js déjà installé");
        else Winget("OpenJS.NodeJS.LTS", "Node.js");
        python = FindPython();
        if (python != null) OnOk("Python déjà installé"); else { Winget("Python.Python.3.12", "Python"); python = FindPython(); }
        if (Which("ffmpeg") != null) OnOk("ffmpeg déjà installé"); else Winget("Gyan.FFmpeg", "ffmpeg");
        if (!File.Exists(ObsExe)) throw new Exception("OBS Studio n'a pas pu être installé.");
        if (python == null) throw new Exception("Python n'a pas pu être installé.");
        OnLog("Module Pillow pour Python (génération des transitions)…");
        Exec(python, PyArgs("-m pip install --user --quiet --disable-pip-version-check pillow"), false);
        OnOk("Logiciels prêts");
    }

    void Winget(string id, string label)
    {
        OnLog("Installation de " + label + "… (Windows peut demander l'autorisation)");
        int code = Exec("winget", "install --id " + id + " -e --silent --accept-package-agreements --accept-source-agreements --disable-interactivity", false);
        RefreshPath();
        if (code == 0) OnOk(label + " installé"); else OnLog(label + " : winget a renvoyé le code " + code);
    }

    // ---------- 2. OBS fermé ----------
    void CloseObs()
    {
        var running = Process.GetProcessesByName("obs64");
        if (running.Length == 0) return;
        OnStep("2/6  Fermeture d'OBS", 30);
        if (!Ask("OBS est ouvert : il va être fermé pour être configuré.\r\nArrête ton live ou ton enregistrement avant de continuer."))
            throw new Exception("Installation annulée : OBS est resté ouvert.");
        foreach (var p in running) { try { p.CloseMainWindow(); } catch { } }
        Thread.Sleep(6000);
        foreach (var p in Process.GetProcessesByName("obs64")) { try { p.Kill(); } catch { } }
        OnOk("OBS fermé");
    }

    // ---------- 3. Plugins Aitum ----------
    void Plugins()
    {
        OnStep("3/6  Plugins Aitum Vertical et Aitum Multistream", 40);
        string zips = Path.Combine(tmp, "plugins");
        Directory.CreateDirectory(zips);
        foreach (var p in new[] { new[] { "Aitum/obs-vertical-canvas", "vertical-canvas" }, new[] { "Aitum/obs-aitum-multistream", "aitum-multistream" } })
        {
            if (Directory.Exists(Path.Combine(PluginDir, p[1]))) { OnOk(p[1] + " déjà installé"); continue; }
            string tag;
            string url = LatestAsset(p[0], @"-windows-programdata\.zip$", out tag);
            Download(url, Path.Combine(zips, p[1] + ".zip"));
            OnLog(p[1] + " " + tag + " téléchargé");
        }
        if (Directory.GetFiles(zips, "*.zip").Length == 0) return;
        try
        {
            Directory.CreateDirectory(PluginDir);
            foreach (var zip in Directory.GetFiles(zips, "*.zip")) Extract(zip, PluginDir, null);
        }
        catch (UnauthorizedAccessException)
        {
            // dossier protégé : copie avec l'autorisation administrateur (une fenêtre Windows le demande)
            OnLog("Autorisation administrateur demandée pour copier les plugins dans OBS…");
            var psi = new ProcessStartInfo(System.Windows.Forms.Application.ExecutablePath, "--plugins \"" + zips + "\"") { Verb = "runas", UseShellExecute = true };
            using (var p = Process.Start(psi)) { p.WaitForExit(); if (p.ExitCode != 0) throw new Exception("Copie des plugins refusée."); }
        }
        OnOk("Plugins Aitum installés dans " + PluginDir);
    }

    // ---------- 4. BL Studio ----------
    void BlStudio()
    {
        OnStep("4/6  Téléchargement de BL Studio", 55);
        string tag;
        string url = LatestAsset(Repo, @"/bl-studio[^/]*\.zip$", out tag);
        string zip = Path.Combine(tmp, "bl-studio.zip");
        Download(url, zip);
        Directory.CreateDirectory(Dest);
        bool hasLogo = File.Exists(Path.Combine(Dest, "logo.png"));
        // données perso (réglages, jetons, points), logo et transitions déjà générées : conservés
        Extract(zip, Dest, rel =>
            rel.StartsWith("hub/data/") || rel == "nowplaying.js" || (rel == "logo.png" && hasLogo) ||
            (rel.StartsWith("transitions/") && File.Exists(Path.Combine(Dest, rel.Replace('/', '\\')))));
        OnOk("BL Studio " + tag + " installé dans " + Dest);
    }

    // ---------- 5. OBS ----------
    void ConfigureObs()
    {
        OnStep("5/6  Configuration d'OBS (scènes, dock, WebSocket, sorties TikTok et YouTube)", 75);
        int code = Exec(python, PyArgs("-I \"" + Path.Combine(Dest, @"setup\obs_setup.py") + "\" --root \"" + Dest + "\""), true);
        if (code != 0) throw new Exception("La configuration d'OBS a échoué (code " + code + ").");
    }

    // ---------- 6. Raccourcis ----------
    void Shortcuts()
    {
        OnStep("6/6  Raccourcis sur le bureau", 90);
        string desk = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        Type t = Type.GetTypeFromProgID("WScript.Shell");
        object shell = Activator.CreateInstance(t);
        object lnk = t.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { Path.Combine(desk, "BL Studio.lnk") });
        Type lt = lnk.GetType();
        lt.InvokeMember("TargetPath", BindingFlags.SetProperty, null, lnk, new object[] { ObsExe });
        lt.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, lnk, new object[] { Path.GetDirectoryName(ObsExe) });
        lt.InvokeMember("Arguments", BindingFlags.SetProperty, null, lnk, new object[] { "--collection \"BL Studio\" --profile \"BL Studio\"" });
        lt.InvokeMember("Description", BindingFlags.SetProperty, null, lnk, new object[] { "OBS avec BL Studio" });
        lt.InvokeMember("Save", BindingFlags.InvokeMethod, null, lnk, null);
        File.WriteAllText(Path.Combine(desk, "BL Studio (panneau).url"), "[InternetShortcut]\r\nURL=http://localhost:3939/\r\n", Encoding.ASCII);
        OnOk("« BL Studio » et « BL Studio (panneau) » ajoutés au bureau");
    }

    // ---------- mode vérification ----------
    void Verify()
    {
        OnStep("1/4  Logiciels présents", 10);
        OnLog((Which("winget") != null ? "✓" : "✗") + " winget (installation automatique des logiciels)");
        OnLog((File.Exists(ObsExe) ? "✓" : "• à installer :") + " OBS Studio");
        OnLog((Which("node") != null || File.Exists(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"nodejs\node.exe")) ? "✓" : "• à installer :") + " Node.js");
        python = FindPython();
        OnLog((python != null ? "✓" : "• à installer :") + " Python" + (python != null ? " (" + python + ")" : ""));
        OnLog((Which("ffmpeg") != null ? "✓" : "• à installer :") + " ffmpeg");
        foreach (var d in new[] { "vertical-canvas", "aitum-multistream" })
            OnLog((Directory.Exists(Path.Combine(PluginDir, d)) ? "✓" : "• à installer :") + " plugin " + d);
        try { Directory.CreateDirectory(PluginDir); string t = Path.Combine(PluginDir, "_bl_test"); Directory.CreateDirectory(t); Directory.Delete(t); OnOk("Dossier des plugins OBS accessible"); }
        catch { OnLog("• Le dossier des plugins OBS demandera l'autorisation administrateur"); }

        OnStep("2/4  Téléchargements GitHub", 35);
        string tag;
        OnOk("Aitum Vertical : " + Path.GetFileName(LatestAsset("Aitum/obs-vertical-canvas", @"-windows-programdata\.zip$", out tag)) + " (" + tag + ")");
        OnOk("Aitum Multistream : " + Path.GetFileName(LatestAsset("Aitum/obs-aitum-multistream", @"-windows-programdata\.zip$", out tag)) + " (" + tag + ")");
        string url = LatestAsset(Repo, @"/bl-studio[^/]*\.zip$", out tag);
        string zip = Path.Combine(tmp, "bl-studio.zip");
        Download(url, zip);
        OnOk("BL Studio " + tag + " téléchargé (" + (new FileInfo(zip).Length / 1048576) + " Mo)");

        OnStep("3/4  Contenu de BL Studio", 60);
        string dir = Path.Combine(tmp, "BLStudio");
        Extract(zip, dir, null);
        foreach (var f in new[] { @"hub\hub.js", @"hub\node_modules\ws\package.json", @"hub\media\bl-media.exe", @"hub\public\app.html", @"setup\obs_setup.py",
                                  "brotherslife.lua", "widget.html", "logo.png", "version.json", @"transitions\stinger_sunset_16x9.webm" })
            OnLog((File.Exists(Path.Combine(dir, f)) ? "✓ " : "✗ manquant : ") + f);
        if (Directory.Exists(Path.Combine(dir, @"hub\data"))) OnLog("✗ hub/data présent dans l'archive (données perso)");

        OnStep("4/4  Configuration d'OBS (dossier d'essai, ton OBS n'est pas touché)", 80);
        if (python == null) { OnLog("• Python absent : la configuration sera testée après son installation"); return; }
        string fakeAppData = Path.Combine(tmp, "AppData");
        Directory.CreateDirectory(fakeAppData);
        int code = Exec(python, PyArgs("-I \"" + Path.Combine(dir, @"setup\obs_setup.py") + "\" --root \"" + dir + "\""), true, fakeAppData);
        if (code != 0) throw new Exception("La configuration d'OBS a échoué (code " + code + ").");
        foreach (var f in new[] { @"obs-studio\basic\scenes\BL_Studio.json", @"obs-studio\basic\profiles\BL_Studio\basic.ini", @"obs-studio\user.ini",
                                  @"obs-studio\plugin_config\obs-websocket\config.json", @"obs-studio\plugin_config\vertical-canvas\config.json" })
            OnLog((File.Exists(Path.Combine(fakeAppData, f)) ? "✓ " : "✗ manquant : ") + f);
        OnOk("Tout est prêt : relance sans --verifier pour installer");
    }

    // python : lanceur « py », sinon un python.exe réel (l'alias du Microsoft Store dans WindowsApps ne compte pas)
    static string FindPython()
    {
        if (Which("py") != null) return "py";
        foreach (string dir in (Environment.GetEnvironmentVariable("Path") ?? "").Split(';'))
        {
            try
            {
                string p = Path.Combine(dir.Trim(), "python.exe");
                if (dir.Trim().Length > 0 && File.Exists(p) && p.IndexOf("WindowsApps", StringComparison.OrdinalIgnoreCase) < 0) return p;
            }
            catch { }
        }
        return null;
    }
    string PyArgs(string args) { return python == "py" ? "-3 " + args : args; }

    // ---------- outils ----------
    static WebClient Client()
    {
        var wc = new WebClient();
        wc.Headers[HttpRequestHeader.UserAgent] = "BL-Studio-Setup";
        wc.Encoding = Encoding.UTF8;
        return wc;
    }

    // dernière release GitHub : URL du fichier dont l'adresse correspond au motif
    static string LatestAsset(string repo, string pattern, out string tag)
    {
        string json;
        using (var wc = Client()) json = wc.DownloadString("https://api.github.com/repos/" + repo + "/releases/latest");
        var mt = Regex.Match(json, "\"tag_name\"\\s*:\\s*\"([^\"]+)\"");
        tag = mt.Success ? mt.Groups[1].Value : "?";
        foreach (Match m in Regex.Matches(json, "\"browser_download_url\"\\s*:\\s*\"([^\"]+)\""))
            if (Regex.IsMatch(m.Groups[1].Value, pattern, RegexOptions.IgnoreCase)) return m.Groups[1].Value;
        throw new Exception("Fichier introuvable dans la dernière version de " + repo);
    }

    void Download(string url, string file)
    {
        OnLog("Téléchargement de " + Path.GetFileName(new Uri(url).AbsolutePath) + "…");
        using (var wc = Client()) wc.DownloadFile(url, file);
    }

    // décompresse en écrasant, sauf les fichiers que « skip » veut garder
    public static void Extract(string zip, string dest, Func<string, bool> skip)
    {
        using (var z = ZipFile.OpenRead(zip))
            foreach (var e in z.Entries)
            {
                string rel = e.FullName.Replace('\\', '/');
                if (rel.EndsWith("/") || (skip != null && skip(rel))) continue;
                string target = Path.GetFullPath(Path.Combine(dest, rel.Replace('/', '\\')));
                if (!target.StartsWith(Path.GetFullPath(dest), StringComparison.OrdinalIgnoreCase)) continue;
                Directory.CreateDirectory(Path.GetDirectoryName(target));
                e.ExtractToFile(target, true);
            }
    }

    int Exec(string file, string args, bool showOutput) { return Exec(file, args, showOutput, null); }
    int Exec(string file, string args, bool showOutput, string appData)
    {
        var psi = new ProcessStartInfo(Which(file) ?? file, args)
        {
            UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardOutput = true, RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8,
        };
        psi.EnvironmentVariables["PYTHONIOENCODING"] = "utf-8";
        if (appData != null) psi.EnvironmentVariables["APPDATA"] = appData;
        using (var p = Process.Start(psi))
        {
            p.OutputDataReceived += (s, e) => { if (showOutput && !string.IsNullOrWhiteSpace(e.Data)) OnLog(e.Data); };
            p.ErrorDataReceived += (s, e) => { if (showOutput && !string.IsNullOrWhiteSpace(e.Data)) OnLog(e.Data); };
            p.BeginOutputReadLine(); p.BeginErrorReadLine();
            p.WaitForExit();
            return p.ExitCode;
        }
    }

    static void RefreshPath()
    {
        Environment.SetEnvironmentVariable("Path",
            Environment.GetEnvironmentVariable("Path", EnvironmentVariableTarget.Machine) + ";" +
            Environment.GetEnvironmentVariable("Path", EnvironmentVariableTarget.User));
    }

    static string Which(string cmd)
    {
        foreach (string dir in (Environment.GetEnvironmentVariable("Path") ?? "").Split(';'))
            foreach (string ext in new[] { ".exe", ".cmd", ".bat" })
            {
                try
                {
                    string p = Path.Combine(dir.Trim(), cmd + ext);
                    if (dir.Trim().Length > 0 && File.Exists(p)) return p;
                }
                catch { }
            }
        return null;
    }
}
