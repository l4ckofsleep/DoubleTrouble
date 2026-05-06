# DoubleTrouble Beta

DoubleTrouble is a local FastAPI + React roleplay chat app with SillyTavern-compatible character cards, presets, chats, swipes, personas, lorebooks, and OpenAI-compatible generation.

## Requirements
- Python 3.12 or newer.
- Node.js 20 or newer.
- Git.
- A provider with an OpenAI-compatible API endpoint, if you want bot replies.

## PC Install And Run
1. Clone the repository:
```powershell
git clone <repo-url>
cd DoubleTrouble_beta
```

2. Install backend dependencies:
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

3. Install and build the frontend:
```powershell
cd frontend
npm install
npm run build
cd ..
```

4. Start the server:
```powershell
python run.py
```

5. Open the app on the same PC:
```text
http://127.0.0.1:8017
```

## Android Install And Run Through Termux
This mode runs the DoubleTrouble server directly on an Android phone through Termux.

1. Install Termux from F-Droid, not from the old Play Store package.

2. Update packages and install dependencies:
```bash
pkg update && pkg upgrade
pkg install git python nodejs-lts
```

3. Clone the repository:
```bash
git clone <repo-url>
cd DoubleTrouble_beta
```

4. Install backend dependencies:
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

5. Install and build the frontend:
```bash
cd frontend
npm install
npm run build
cd ..
```

6. Create `config/config.yaml`:
```bash
mkdir -p config
nano config/config.yaml
```

Use this config for local phone-only access:
```yaml
server:
  listen_ip: 127.0.0.1
  listen_port: 8017
  public_url: null
  open_browser_on_start: false

storage:
  data_root: data
  default_user: default-user

auth:
  mode: disabled
  frontend_password: ''

security:
  allow_key_checking: true
  allow_external_connections: false
```

Use this config if other devices should connect to the phone server over Wi-Fi:
```yaml
server:
  listen_ip: 0.0.0.0
  listen_port: 8017
  public_url: null
  open_browser_on_start: false

storage:
  data_root: data
  default_user: default-user

auth:
  mode: disabled
  frontend_password: ''

security:
  allow_key_checking: true
  allow_external_connections: true
```

7. Start DoubleTrouble:
```bash
python run.py
```

8. Open it on the same phone:
```text
http://127.0.0.1:8017
```

9. To access the phone server from another device, find the phone IP in Android Wi-Fi details and open:
```text
http://<PHONE-LAN-IP>:8017
```

If Android kills Termux in the background, disable battery optimization for Termux.

## Phone Access To A PC Server
The phone is used as a browser client. The server still runs on your PC.

1. Connect the phone and PC to the same Wi-Fi network.

2. Create `config/config.yaml` on the PC:
```yaml
server:
  listen_ip: 0.0.0.0
  listen_port: 8017
  public_url: null
  open_browser_on_start: false

storage:
  data_root: data
  default_user: default-user

auth:
  mode: disabled
  frontend_password: ''

security:
  allow_key_checking: true
  allow_external_connections: true
```

3. Start the server on the PC:
```powershell
python run.py
```

4. Find the PC local IP address:
```powershell
ipconfig
```

5. Open this URL on the phone browser:
```text
http://<PC-LAN-IP>:8017
```

Example:
```text
http://192.168.1.25:8017
```

6. If the phone cannot connect, allow Python through Windows Firewall for private networks.

## First Setup In The App
1. Open `Подключение` and configure provider URL, model, and API key.
2. Save a connection preset.
3. Import or create a character card in `Карточки`.
4. Create or select a persona in `Персоны`.
5. Optional: import SillyTavern presets and lorebooks in `Пресеты` and `Лорбуки`.

## Data And Privacy
Runtime user data is intentionally not committed to git.

Ignored local data includes:
- `data/default-user/secrets.yaml` API keys.
- `data/default-user/users.yaml` accounts and password hashes.
- `data/default-user/settings.yaml` local app settings.
- chats, personas, avatars, cards, lorebooks, imported presets, and exports.
- `config/config.yaml` local network and machine-specific config.

Keep backups of `data/default-user` separately if you need to preserve your local chats and cards.

## Useful Commands
Build frontend:
```powershell
cd frontend
npm run build
```

Compile backend:
```powershell
python -m compileall "backend" "run.py"
```

Run server:
```powershell
python run.py
```

Health check:
```powershell
Invoke-RestMethod http://127.0.0.1:8017/api/health
```
