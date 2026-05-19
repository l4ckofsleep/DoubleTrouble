<p align="center">
  <img src="frontend/public/favicon.png" width="96" height="96" alt="DoubleTrouble logo" />
</p>

<h1 align="center">DoubleTrouble</h1>
<p align="center">Локальный ролевой чат с карточками SillyTavern, персонами, лорбуками и генерацией через OpenAI-совместимое API.</p>

<p align="center">
  <img alt="Python" src="https://img.shields.io/badge/python-3.12+-blue?logo=python&logoColor=white">
  <img alt="Node.js" src="https://img.shields.io/badge/node-20+-green?logo=nodedotjs&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/fastapi-009688?logo=fastapi&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-lightgrey">
</p>

---

## Оглавление

- [Возможности](#возможности)
- [Требования](#требования)
- [Быстрый старт](#быстрый-старт)
- [Установка](#установка)
  - [Windows](#windows)
  - [Linux](#linux)
  - [Android (Termux)](#android-termux)
- [Удаленный доступ](#удаленный-доступ)
- [Первая настройка](#первая-настройка)
- [Обновление](#обновление)
- [Данные и приватность](#данные-и-приватность)
- [Решение проблем](#решение-проблем)
- [English version below](#english)

---

## Возможности

- **Совместимость с SillyTavern** — импорт карточек персонажей (PNG/WebP), пресетов и лорбуков.
- **Мультиплеер** — локальные сетевые сессии с персонами и общими чатами.
- **Свайпы** — регенерация и сравнение ответов бота на лету.
- **Персоны** — переключение между личинами пользователя в каждом чате.
- **OpenAI-совместимость** — работает с любым провайдером, предоставляющим OpenAI-стиль API.
- **Приватность** — всё работает локально, без зависимости от облака.
- **Адаптивный интерфейс** — работает на десктопе и в мобильных браузерах.

## Требования

| Компонент | Минимальная версия |
|-----------|--------------------|
| Python    | 3.12               |
| Node.js   | 20                 |
| Git       | любая              |
| ОС        | Windows, Linux, macOS, Android (через Termux) |

Для ответов бота нужен OpenAI-совместимый провайдер (локальная LLM, KoboldCPP, Ollama с OpenAI-прокси и т.д.).

## Быстрый старт

Если Python, Node и Git уже установлены:

```bash
# 1. Клонировать
git clone <repo-url>
cd DoubleTrouble

# 2. Бэкенд
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/Termux: source .venv/bin/activate
pip install -r backend/requirements.txt

# 3. Фронтенд
cd frontend
npm install
npm run build
cd ..

# 4. Запуск
python run.py
```

Открой `http://127.0.0.1:8017` в браузере.

> **Windows:** можно запустить `start.bat` или `start.ps1` — скрипт автоматизирует шаги 2-4.

---

## Установка

### Windows

#### Вариант А — Скрипт в один клик (PowerShell)

```powershell
git clone <repo-url>
cd DoubleTrouble
.\start.ps1
```

Скрипт создаст venv, установит зависимости, соберёт фронтенд и запустит сервер.

#### Вариант Б — Вручную

```powershell
# 1. Клонировать
git clone <repo-url>
cd DoubleTrouble

# 2. Бэкенд
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt

# 3. Фронтенд
cd frontend
npm install
npm run build
cd ..

# 4. Запуск
python run.py
```

Открой `http://127.0.0.1:8017`.

---

### Linux

#### Вариант А — Скрипт в один клик (Bash)

```bash
git clone <repo-url>
cd DoubleTrouble
chmod +x start.sh
./start.sh
```

#### Вариант Б — Вручную

```bash
# 1. Клонировать
git clone <repo-url>
cd DoubleTrouble

# 2. Бэкенд
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

# 3. Фронтенд
cd frontend
npm install
npm run build
cd ..

# 4. Запуск
python3 run.py
```

Открой `http://127.0.0.1:8017`.

---

### Android (Termux)

Сервер запускается **прямо на телефоне**.

1. Установи **Termux** из [F-Droid](https://f-droid.org/packages/com.termux/) (не используй старую версию из Play Store).

2. Обнови пакеты и установи зависимости:

```bash
pkg update && pkg upgrade
pkg install git python nodejs-lts
```

3. Клонируй и установи:

```bash
git clone <repo-url>
cd DoubleTrouble
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cd frontend
npm install
npm run build
cd ..
```

4. Создай конфиг:

```bash
mkdir -p config
nano config/config.yaml
```

**Для локального доступа** (только с этого телефона):

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

**Для доступа по Wi-Fi** (с других устройств):

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

5. Запуск:

```bash
python run.py
```

6. Открой `http://127.0.0.1:8017` на этом же телефоне.

> **Совет:** Чтобы Android не убивал Termux в фоне, отключи оптимизацию батареи для Termux в настройках телефона.

---

## Удаленный доступ

### Телефон → сервер на ПК

Если сервер крутится на компьютере, можно зайти с телефона по одной Wi-Fi-сети.

1. На ПК создай `config/config.yaml` с `listen_ip: 0.0.0.0` и `allow_external_connections: true` (см. конфиг Android LAN выше).
2. Запусти сервер на ПК: `python run.py`
3. Узнай локальный IP ПК:
   - **Windows:** `ipconfig`
   - **Linux:** `ip addr` или `hostname -I`
4. В браузере телефона открой:

```text
http://<IP-ПК>:8017
```

Пример: `http://192.168.1.25:8017`

> **Windows:** Если телефон не подключается, разреши Python в брандмауэре Windows для **частных** сетей.

---

## Способы подключения через интернет

Если у вас и ваших друзей нет общей Wi-Fi-сети, используйте один из методов ниже. Все они работают с DoubleTrouble.

> **Важно:** перед началом убедитесь, что в `config/config.yaml` указано `listen_ip: 0.0.0.0` и `allow_external_connections: true`.

---

### 1. Открытие портов на роутере (Port Forwarding)

Самый быстрый способ, но требует доступа к настройкам роутера.

**Шаги:**
1. Узнай локальный IP ПК: `ipconfig` (Windows) или `ip addr` (Linux).
2. Открой настройки роутера в браузере (обычно `192.168.1.1` или `192.168.0.1`).
3. Найди раздел **Port Forwarding / Virtual Servers / NAT**.
4. Добавь правило:
   - **External port:** `8017`
   - **Internal IP:** IP твоего ПК (например, `192.168.1.25`)
   - **Internal port:** `8017`
   - **Protocol:** `TCP`
5. Узнай внешний IP роутера: [2ip.ru](https://2ip.ru) или [ifconfig.me](https://ifconfig.me).
6. Друзья подключаются по адресу:

```text
http://<ВНЕШНИЙ-IP>:8017
```

> ⚠️ Внешний IP может меняться. Если у провайдера динамический IP — используй DDNS (No-IP, Duck DNS) или один из VPN-способов ниже.

---

### 2. Radmin VPN

Бесплатный VPN, простой как Hamachi. Не требует регистрации.

1. **Все участники** скачивают и устанавливают [Radmin VPN](https://www.radmin-vpn.com/).
2. **Хост** (тот, у кого запущен сервер):
   - Создаёт сеть: `Network → Create Network`
   - Запоминает **Network name** и **Password**.
3. **Гости**:
   - `Network → Join Network` → вводят имя и пароль сети.
4. **Хост** узнаёт свой VPN-IP в Radmin VPN (обычно `26.x.x.x`).
5. **Все** открывают в браузере:

```text
http://<VPN-IP-ХОСТА>:8017
```

> ✅ Скорость до 100 Мбит/с, бесплатно, без лимита участников.

---

### 3. Tailscale

Современная mesh-VPN на базе WireGuard. Надёжная и безопасная.

1. **Все участники** регистрируются на [tailscale.com](https://tailscale.com/) и устанавливают клиент.
2. Авторизуют устройства под одним аккаунтом (или приглашают друг друга в сеть).
3. **Хост** запускает DoubleTrouble (`python run.py`).
4. **Хост** находит свой Tailscale-IP в приложении (начинается на `100.x.x.x`).
5. **Все** открывают:

```text
http://<TAILSCALE-IP-ХОСТА>:8017
```

> ✅ Бесплатно до 3 пользователей и 100 устройств. Работает через NAT и firewall без настройки.

---

### 4. ZeroTier

Альтернатива Tailscale. Создаёт виртуальную LAN без открытия портов.

1. **Хост** регистрируется на [my.zerotier.com](https://my.zerotier.com/), создаёт сеть и копирует **Network ID**.
2. **Все участники** устанавливают ZeroTier и присоединяются к сети по **Network ID**.
3. **Хост** в веб-панели ZeroTier одобряет новые устройства (Auth).
4. **Хост** запускает DoubleTrouble.
5. **Хост** смотрит свой ZeroTier IP в веб-панели (например, `192.168.192.x`).
6. **Все** открывают:

```text
http://<ZEROTIER-IP-ХОСТА>:8017
```

> ✅ Бесплатно до 25 устройств. Не требует регистрации у гостей.

---

### 5. ngrok

Мгновенный доступ без роутера и VPN. Подходит для быстрых тестов.

1. **Хост** регистрируется на [ngrok.com](https://ngrok.com/), скачивает и устанавливает ngrok.
2. Авторизует ngrok по токену (один раз):

```bash
ngrok config add-authtoken <ТВОЙ-ТОКЕН>
```

3. Запускает туннель:

```bash
ngrok http 8017
```

4. В терминале появится временный URL:

```text
Forwarding  https://abc123.ngrok-free.app -> http://localhost:8017
```

5. **Все** открывают этот URL в браузере.

> ⚠️ Бесплатный тариф: URL меняется при каждом запуске. Для постоянного URL нужен платный тариф.

---

### 6. Cloudflare Tunnel (быстрый туннель)

Бесплатный туннель без регистрации (для тестов).

1. **Хост** скачивает [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel/).
2. Запускает быстрый туннель:

```bash
cloudflared tunnel --url http://localhost:8017
```

3. В терминале появится временный URL на `trycloudflare.com`:

```text
https://random-name.trycloudflare.com
```

4. **Все** открывают этот URL.

> ⚠️ Бесплатный quick tunnel: URL случайный, ограничение 200 одновременных запросов. Для постоянного URL нужен аккаунт Cloudflare и настройка туннеля.

---

### Сравнение способов

| Способ | Сложность | Скорость | Постоянный URL | Бесплатно |
|--------|-----------|----------|----------------|-----------|
| Port Forwarding | Средняя | Максимальная | Да (с DDNS) | Да |
| Radmin VPN | Легкая | Хорошая | Да (внутри VPN) | Да |
| Tailscale | Легкая | Отличная | Да (внутри VPN) | Да (до 3 чел.) |
| ZeroTier | Средняя | Хорошая | Да (внутри VPN) | Да (до 25 устр.) |
| ngrok | Легкая | Хорошая | Нет | Да (URL меняется) |
| Cloudflare Tunnel | Легкая | Хорошая | Нет | Да (URL меняется) |

> **Рекомендация:** для регулярной игры с друзьями — **Tailscale** или **Radmin VPN**. Для разового теста — **Cloudflare quick tunnel** или **ngrok**.

---

## Первая настройка

После запуска приложения:

1. **Подключение** — укажи URL провайдера, модель и API-ключ. Сохрани пресет.
2. **Карточки** — импортируй карточку SillyTavern (PNG/WebP) или создай вручную.
3. **Персоны** — создай или выбери персону для себя.
4. **Пресеты / Лорбуки** — опционально: импортируй пресеты и лорбуки из SillyTavern.
5. Начни чат.

---

## Обновление

Скачай обновления и пересобери:

```bash
git pull origin main
# Переактивируй venv при необходимости
pip install -r backend/requirements.txt
cd frontend && npm install && npm run build && cd ..
python run.py
```

> **Windows:** `.\start.ps1` автоматически пересоберёт всё.

---

## Данные и приватность

Твои локальные данные **никогда не попадают** в git.

Защищенные файлы и папки:

- `data/default-user/` — чаты, персоны, аватарки, карточки, лорбуки, пресеты, экспорты.
- `data/default-user/secrets.yaml` — API-ключи.
- `data/default-user/users.yaml` — аккаунты и хеши паролей.
- `data/default-user/settings.yaml` — настройки приложения.
- `config/config.yaml` — локальная сетевая конфигурация.

**Регулярно делай бэкапы `data/default-user`**, если хочешь сохранить чаты и карточки.

---

## Решение проблем

| Проблема | Решение |
|----------|---------|
| `ModuleNotFoundError` | Убедись, что venv активирован перед `pip install` и `python run.py`. |
| Пустая страница | Пересобери фронтенд: `cd frontend && npm run build`. |
| Порт 8017 занят | Измени `listen_port` в `config/config.yaml`. |
| Телефон не видит ПК | Проверь брандмауэр, убедись, что оба устройства в **одной Wi-Fi**, и используй **LAN IP** ПК (не `127.0.0.1`). |
| Termux убивается Android | Отключи оптимизацию батареи для Termux в настройках. |
| Node.js не найден в Termux | Устанавливай `nodejs-lts`, а не `nodejs`. |

---

## Полезные команды

```bash
# Пересборка фронтенда
cd frontend && npm run build

# Проверка работоспособности
# Windows (PowerShell):
Invoke-RestMethod http://127.0.0.1:8017/api/health
# Linux/macOS/Termux:
curl http://127.0.0.1:8017/api/health
```

---

---

<a id="english"></a>

<h1 align="center">DoubleTrouble</h1>
<p align="center">Local roleplay chat with SillyTavern-compatible cards, personas, lorebooks, and OpenAI-compatible generation.</p>

## Table of Contents

- [Features](#features-en)
- [Requirements](#requirements-en)
- [Quick Start](#quick-start-en)
- [Install Guides](#install-guides-en)
  - [Windows](#windows-en)
  - [Linux](#linux-en)
  - [Android (Termux)](#android-termux-en)
- [Remote Access](#remote-access-en)
- [First Setup](#first-setup-en)
- [Updating](#updating-en)
- [Data & Privacy](#data--privacy-en)
- [Troubleshooting](#troubleshooting-en)

---

<a id="features-en"></a>
## Features

- **SillyTavern-compatible** — import character cards (PNG/WebP), presets, and lorebooks.
- **Multiplayer** — local network sessions with personas and shared chats.
- **Swipes** — regenerate and compare bot replies on the fly.
- **Personas** — switch between user identities per chat.
- **OpenAI-compatible** — works with any provider that exposes an OpenAI-style API.
- **Privacy-first** — everything stays local by default. No cloud dependency.
- **Responsive UI** — works on desktop and mobile browsers.

<a id="requirements-en"></a>
## Requirements

| Component | Minimum Version |
|-----------|-----------------|
| Python    | 3.12            |
| Node.js   | 20              |
| Git       | any             |
| OS        | Windows, Linux, macOS, Android (via Termux) |

You also need an OpenAI-compatible API endpoint if you want bot replies (local LLM, KoboldCPP, Ollama with OpenAI proxy, etc.).

<a id="quick-start-en"></a>
## Quick Start

```bash
# 1. Clone
git clone <repo-url>
cd DoubleTrouble

# 2. Backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/Termux: source .venv/bin/activate
pip install -r backend/requirements.txt

# 3. Frontend
cd frontend
npm install
npm run build
cd ..

# 4. Start
python run.py
```

Then open `http://127.0.0.1:8017`.

> **Windows:** you can also run `start.bat` or `start.ps1`.

---

<a id="install-guides-en"></a>
## Install Guides

<a id="windows-en"></a>
### Windows

#### Option A — One-click script (PowerShell)

```powershell
git clone <repo-url>
cd DoubleTrouble
.\start.ps1
```

#### Option B — Manual

```powershell
git clone <repo-url>
cd DoubleTrouble
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
cd frontend
npm install
npm run build
cd ..
python run.py
```

---

<a id="linux-en"></a>
### Linux

#### Option A — One-click script (Bash)

```bash
git clone <repo-url>
cd DoubleTrouble
chmod +x start.sh
./start.sh
```

#### Option B — Manual

```bash
git clone <repo-url>
cd DoubleTrouble
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cd frontend
npm install
npm run build
cd ..
python3 run.py
```

---

<a id="android-termux-en"></a>
### Android (Termux)

1. Install **Termux** from [F-Droid](https://f-droid.org/packages/com.termux/).

2. Update and install:

```bash
pkg update && pkg upgrade
pkg install git python nodejs-lts
```

3. Clone and install:

```bash
git clone <repo-url>
cd DoubleTrouble
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cd frontend
npm install
npm run build
cd ..
```

4. Create config:

```bash
mkdir -p config
nano config/config.yaml
```

**Local-only access:**

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

**LAN access:**

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

5. Start:

```bash
python run.py
```

6. Open `http://127.0.0.1:8017` on the phone.

> **Tip:** Disable battery optimization for Termux.

---

<a id="remote-access-en"></a>
## Remote Access

### Phone → PC server

1. On the PC, create `config/config.yaml` with `listen_ip: 0.0.0.0` and `allow_external_connections: true`.
2. Start the PC server: `python run.py`
3. Find PC local IP:
   - **Windows:** `ipconfig`
   - **Linux:** `ip addr` or `hostname -I`
4. On the phone browser, open:

```text
http://<PC-LAN-IP>:8017
```

> **Windows:** Allow Python through Windows Firewall for **private** networks.

---

<a id="internet-connection-en"></a>
## Internet Connection Methods

If you and your friends don't share a Wi-Fi network, use one of the methods below. All of them work with DoubleTrouble.

> **Important:** before starting, make sure `config/config.yaml` has `listen_ip: 0.0.0.0` and `allow_external_connections: true`.

---

### 1. Port Forwarding

The fastest method, but requires access to your router settings.

**Steps:**
1. Find your PC's local IP: `ipconfig` (Windows) or `ip addr` (Linux).
2. Open your router settings in a browser (usually `192.168.1.1` or `192.168.0.1`).
3. Find the **Port Forwarding / Virtual Servers / NAT** section.
4. Add a rule:
   - **External port:** `8017`
   - **Internal IP:** your PC's IP (e.g., `192.168.1.25`)
   - **Internal port:** `8017`
   - **Protocol:** `TCP`
5. Find your router's public IP: [2ip.ru](https://2ip.ru) or [ifconfig.me](https://ifconfig.me).
6. Friends connect to:

```text
http://<PUBLIC-IP>:8017
```

> ⚠️ Public IP may change. If your ISP uses dynamic IP, use DDNS (No-IP, Duck DNS) or one of the VPN methods below.

---

### 2. Radmin VPN

Free VPN, as simple as Hamachi. No registration required.

1. **All participants** download and install [Radmin VPN](https://www.radmin-vpn.com/).
2. **Host** (the one running the server):
   - Creates a network: `Network → Create Network`
   - Notes the **Network name** and **Password**.
3. **Guests**:
   - `Network → Join Network` → enter the network name and password.
4. **Host** checks their VPN IP in Radmin VPN (usually `26.x.x.x`).
5. **Everyone** opens in their browser:

```text
http://<HOST-VPN-IP>:8017
```

> ✅ Speed up to 100 Mbps, free, unlimited participants.

---

### 3. Tailscale

Modern mesh VPN based on WireGuard. Reliable and secure.

1. **All participants** sign up at [tailscale.com](https://tailscale.com/) and install the client.
2. Authorize devices under one account (or invite each other to the network).
3. **Host** starts DoubleTrouble (`python run.py`).
4. **Host** finds their Tailscale IP in the app (starts with `100.x.x.x`).
5. **Everyone** opens:

```text
http://<HOST-TAILSCALE-IP>:8017
```

> ✅ Free for up to 3 users and 100 devices. Works through NAT and firewall without setup.

---

### 4. ZeroTier

Alternative to Tailscale. Creates a virtual LAN without opening ports.

1. **Host** signs up at [my.zerotier.com](https://my.zerotier.com/), creates a network, and copies the **Network ID**.
2. **All participants** install ZeroTier and join the network using the **Network ID**.
3. **Host** approves new devices in the ZeroTier web panel (Auth).
4. **Host** starts DoubleTrouble.
5. **Host** checks their ZeroTier IP in the web panel (e.g., `192.168.192.x`).
6. **Everyone** opens:

```text
http://<HOST-ZEROTIER-IP>:8017
```

> ✅ Free for up to 25 devices. Guests don't need to register.

---

### 5. ngrok

Instant access without router or VPN. Good for quick tests.

1. **Host** signs up at [ngrok.com](https://ngrok.com/), downloads and installs ngrok.
2. Authorize ngrok with a token (one time):

```bash
ngrok config add-authtoken <YOUR-TOKEN>
```

3. Start the tunnel:

```bash
ngrok http 8017
```

4. A temporary URL appears in the terminal:

```text
Forwarding  https://abc123.ngrok-free.app -> http://localhost:8017
```

5. **Everyone** opens that URL in their browser.

> ⚠️ Free tier: URL changes on every launch. Paid plan required for a permanent URL.

---

### 6. Cloudflare Tunnel (Quick Tunnel)

Free tunnel without registration (for testing).

1. **Host** downloads [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel/).
2. Start the quick tunnel:

```bash
cloudflared tunnel --url http://localhost:8017
```

3. A temporary URL on `trycloudflare.com` appears in the terminal:

```text
https://random-name.trycloudflare.com
```

4. **Everyone** opens that URL.

> ⚠️ Free quick tunnel: random URL, 200 concurrent request limit. Permanent URL requires a Cloudflare account and tunnel setup.

---

### Method Comparison

| Method | Difficulty | Speed | Permanent URL | Free |
|--------|-----------|-------|---------------|------|
| Port Forwarding | Medium | Maximum | Yes (with DDNS) | Yes |
| Radmin VPN | Easy | Good | Yes (inside VPN) | Yes |
| Tailscale | Easy | Excellent | Yes (inside VPN) | Yes (up to 3 users) |
| ZeroTier | Medium | Good | Yes (inside VPN) | Yes (up to 25 devices) |
| ngrok | Easy | Good | No | Yes (URL changes) |
| Cloudflare Tunnel | Easy | Good | No | Yes (URL changes) |

> **Recommendation:** for regular sessions with friends — **Tailscale** or **Radmin VPN**. For a one-time test — **Cloudflare quick tunnel** or **ngrok**.

---

<a id="first-setup-en"></a>
## First Setup

1. **Connection** — configure provider URL, model, and API key. Save a preset.
2. **Cards** — import a SillyTavern PNG/WebP card or create one manually.
3. **Personas** — create or select a persona.
4. **Presets / Lorebooks** — optional: import from SillyTavern.
5. Start a chat.

---

<a id="updating-en"></a>
## Updating

```bash
git pull origin main
pip install -r backend/requirements.txt
cd frontend && npm install && npm run build && cd ..
python run.py
```

> **Windows:** `.\start.ps1` handles the rebuild.

---

<a id="data--privacy-en"></a>
## Data & Privacy

Your local data is **never committed** to git.

Protected files:

- `data/default-user/` — chats, personas, avatars, cards, lorebooks, presets, exports.
- `data/default-user/secrets.yaml` — API keys.
- `data/default-user/users.yaml` — accounts and password hashes.
- `data/default-user/settings.yaml` — app settings.
- `config/config.yaml` — machine-specific network config.

**Back up `data/default-user` regularly.**

---

<a id="troubleshooting-en"></a>
## Troubleshooting

| Problem | Solution |
|---------|----------|
| `ModuleNotFoundError` | Make sure venv is activated before `pip install` or `python run.py`. |
| Blank page | Rebuild: `cd frontend && npm run build`. |
| Port 8017 busy | Change `listen_port` in `config/config.yaml`. |
| Phone cannot reach PC | Check firewall, same Wi-Fi, use PC's **LAN IP** (not `127.0.0.1`). |
| Termux killed | Disable battery optimization for Termux. |
| Node.js not found on Termux | Install `nodejs-lts` (not `nodejs`). |

---

## Useful Commands

```bash
# Rebuild frontend
cd frontend && npm run build

# Health check
# Windows (PowerShell):
Invoke-RestMethod http://127.0.0.1:8017/api/health
# Linux/macOS/Termux:
curl http://127.0.0.1:8017/api/health
```
