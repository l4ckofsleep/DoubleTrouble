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
