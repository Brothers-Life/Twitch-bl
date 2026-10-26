-- BL Studio — démarre le BL Hub avec OBS + widget musique Spotify.
-- Lit le titre de la fenêtre Spotify et l'écrit dans nowplaying.js (lu par widget.html?w=music).
-- Lance hub/hub.js (Node.js) en arrière-plan à l'ouverture d'OBS et l'arrête à la fermeture.
-- Les éléments de l'overlay sont des sources OBS : clic droit > Propriétés pour les régler.

obs = obslua
local ffi = require("ffi")

ffi.cdef[[
typedef void* HWND;
typedef void* HANDLE;
typedef unsigned long DWORD;
typedef int BOOL;
HWND FindWindowExW(HWND parent, HWND after, const uint16_t* cls, const uint16_t* title);
int GetWindowTextW(HWND h, uint16_t* buf, int n);
BOOL IsWindowVisible(HWND h);
DWORD GetWindowThreadProcessId(HWND h, DWORD* pid);
HANDLE OpenProcess(DWORD access, BOOL inherit, DWORD pid);
BOOL QueryFullProcessImageNameW(HANDLE h, DWORD flags, uint16_t* buf, DWORD* size);
BOOL CloseHandle(HANDLE h);
int WideCharToMultiByte(unsigned int cp, DWORD flags, const uint16_t* w, int wl, char* s, int sl, const char* d, BOOL* u);
int MultiByteToWideChar(unsigned int cp, DWORD flags, const char* s, int sl, uint16_t* w, int wl);
typedef struct { DWORD cb; void* lpReserved; void* lpDesktop; void* lpTitle; DWORD dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars,
  dwFillAttribute, dwFlags; uint16_t wShowWindow, cbReserved2; void* lpReserved2; HANDLE hStdInput, hStdOutput, hStdError; } STARTUPINFOW;
typedef struct { HANDLE hProcess; HANDLE hThread; DWORD dwProcessId; DWORD dwThreadId; } PROCESS_INFORMATION;
BOOL CreateProcessW(const uint16_t* app, uint16_t* cmd, void* pa, void* ta, BOOL inherit, DWORD flags, void* env, const uint16_t* cwd,
  STARTUPINFOW* si, PROCESS_INFORMATION* pi);
BOOL TerminateProcess(HANDLE h, unsigned int code);
]]

local PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
local CP_UTF8 = 65001
local dir = script_path()
local last_np = nil

-- ---------- utilitaires ----------
local function utf8(wbuf, len)
	if len <= 0 then return "" end
	local n = ffi.C.WideCharToMultiByte(CP_UTF8, 0, wbuf, len, nil, 0, nil, nil)
	local out = ffi.new("char[?]", n)
	ffi.C.WideCharToMultiByte(CP_UTF8, 0, wbuf, len, out, n, nil, nil)
	return ffi.string(out, n)
end

local function json_str(s)
	s = s:gsub('[%c"\\]', function(c)
		if c == '"' then return '\\"' elseif c == "\\" then return "\\\\"
		elseif c == "\n" then return "\\n" else return string.format("\\u%04x", c:byte()) end
	end)
	return '"' .. s .. '"'
end

local function write_file(name, content)
	local f = io.open(dir .. name, "wb")
	if f then f:write(content); f:close() end
end

-- ---------- BL Hub ----------
local hub_process = nil

local function wide(str)
	local n = ffi.C.MultiByteToWideChar(CP_UTF8, 0, str, -1, nil, 0)
	local buf = ffi.new("uint16_t[?]", n)
	ffi.C.MultiByteToWideChar(CP_UTF8, 0, str, -1, buf, n)
	return buf
end

local function start_hub()
	local hub_dir = dir .. "hub"
	local si = ffi.new("STARTUPINFOW")
	si.cb = ffi.sizeof(si)
	local pi = ffi.new("PROCESS_INFORMATION")
	local CREATE_NO_WINDOW = 0x08000000
	-- si le Hub tourne déjà, la nouvelle instance s'arrête toute seule (port 3939 occupé)
	-- juste après l'installation, le PATH d'OBS ne connaît pas encore Node.js : on essaie le dossier standard
	local node = "node"
	local f = io.open("C:/Program Files/nodejs/node.exe", "rb")
	if f then f:close(); node = '"C:/Program Files/nodejs/node.exe"' end
	if ffi.C.CreateProcessW(nil, wide(node .. ' "' .. hub_dir .. '/hub.js"'), nil, nil, 0, CREATE_NO_WINDOW, nil, wide(hub_dir), si, pi) ~= 0 then
		hub_process = pi.hProcess
		ffi.C.CloseHandle(pi.hThread)
	else
		obs.script_log(obs.LOG_WARNING, "BL Hub : impossible de lancer Node.js (installé ?)")
	end
end

local function stop_hub()
	if hub_process ~= nil then
		ffi.C.TerminateProcess(hub_process, 0)
		ffi.C.CloseHandle(hub_process)
		hub_process = nil
	end
end

-- ---------- Spotify ----------
local spotify_hwnd = nil
local title_buf = ffi.new("uint16_t[512]")

local function window_title(hwnd)
	return utf8(title_buf, ffi.C.GetWindowTextW(hwnd, title_buf, 512))
end

local function process_name(hwnd)
	local pid = ffi.new("DWORD[1]")
	ffi.C.GetWindowThreadProcessId(hwnd, pid)
	local h = ffi.C.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid[0])
	if h == nil then return "" end
	local buf = ffi.new("uint16_t[520]")
	local size = ffi.new("DWORD[1]", 520)
	local name = ""
	if ffi.C.QueryFullProcessImageNameW(h, 0, buf, size) ~= 0 then
		name = utf8(buf, size[0]):match("([^\\]+)$") or ""
	end
	ffi.C.CloseHandle(h)
	return name:lower()
end

local function find_spotify()
	if spotify_hwnd ~= nil and window_title(spotify_hwnd) ~= "" and process_name(spotify_hwnd) == "spotify.exe" then
		return spotify_hwnd
	end
	spotify_hwnd = nil
	local hwnd = ffi.C.FindWindowExW(nil, nil, nil, nil)
	while hwnd ~= nil do
		if ffi.C.IsWindowVisible(hwnd) ~= 0 and window_title(hwnd) ~= "" and process_name(hwnd) == "spotify.exe" then
			spotify_hwnd = hwnd
			return hwnd
		end
		hwnd = ffi.C.FindWindowExW(nil, hwnd, nil, nil)
	end
	return nil
end

local function update_nowplaying()
	local playing, artist, title = false, "", ""
	local hwnd = find_spotify()
	if hwnd ~= nil then
		-- en pause la fenêtre s'appelle "Spotify", "Spotify Free" ou "Spotify Premium"
		local t = window_title(hwnd)
		local a, s = t:match("^(.-) %- (.+)$")
		if a and not t:match("^Spotify") then playing, artist, title = true, a, s end
	end
	local js = string.format("window.__NP = {\"playing\":%s,\"artist\":%s,\"title\":%s};",
		tostring(playing), json_str(artist), json_str(title))
	if js ~= last_np then
		write_file("nowplaying.js", js)
		last_np = js
	end
end

function script_description()
	return [[<h3>BL Studio</h3>
Démarre le <b>BL Hub</b> (alertes, chat unifié, bot, mini-jeux, stats, mises à jour) avec OBS : dock « BL Studio » ou http://localhost:3939<br>
Envoie le titre Spotify en cours au widget <b>Musique</b>.<br>
Les éléments de l'overlay se règlent dans leurs sources : clic droit &gt; <b>Propriétés</b>.]]
end

function script_load(settings)
	start_hub()
	update_nowplaying()
	obs.timer_add(update_nowplaying, 2000)
end

function script_unload()
	obs.timer_remove(update_nowplaying)
	stop_hub()
end
