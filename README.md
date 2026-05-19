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

Если вы и ваши друзья находитесь в разных городах или у вас нет общей Wi-Fi-сети, нужно как-то "соединить" ваши компьютеры через интернет. Ниже описаны все способы — от простых (VPN) до продвинутых (открытие портов).

> **Важно:** перед началом убедитесь, что в `config/config.yaml` указано `listen_ip: 0.0.0.0` и `allow_external_connections: true`.

---

### Как это работает (простыми словами)

```
┌─────────────────┐                      ┌─────────────────┐
│   Твой ПК       │      Интернет        │   ПК друга      │
│  (DoubleTrouble)│  ◄────────────────►  │   (Браузер)     │
│  IP: 192.168.x  │                      │  IP: 192.168.y  │
└─────────────────┘                      └─────────────────┘
         │                                        │
         └─────────── ❌ НЕ соединяются напрямую ──┘
```

Ваши компьютеры дома сидят **за роутером** (NAT). У каждого свой "локальный" IP (`192.168.x.x`), но в интернете они выходят через один "внешний" IP роутера. Поэтому друг не может просто набрать твой IP и подключиться — роутер не знает, кому пересылать запрос.

**Решения:**
- **VPN** (Radmin, Tailscale, ZeroTier) — создаёт "виртуальную локалку", где у всех появляются прямые IP-адреса внутри VPN.
- **Port Forwarding** — ты говоришь роутеру: "все запросы на порт 8017 отправляй на мой ПК".
- **Туннели** (ngrok, Cloudflare) — внешний сервер даёт тебе временный публичный URL, который ведёт на твой ПК.

---

### Предварительная проверка

Перед тем как пытаться подключить друга, убедись, что DoubleTrouble **уже работает локально**:

1. Запусти сервер: `python run.py`
2. Открой на **своём** ПК: `http://127.0.0.1:8017` — должна открыться страница приложения.
3. Узнай свой локальный IP:
   - **Windows:** открой PowerShell → `ipconfig` → ищи строку `IPv4 Address` (например, `192.168.1.25`).
   - **Linux/Termux:** `ip addr` или `hostname -I`.
4. Открой на **другом устройстве** в той же Wi-Fi: `http://<ТВОЙ-ЛОКАЛЬНЫЙ-IP>:8017` (например, `http://192.168.1.25:8017`).
   - Если открылось — Wi-Fi/LAN-режим работает.
   - Если **не открылось** — проверь брандмауэр (Windows) или `allow_external_connections: true` в конфиге.

> Только после этого переходи к методам ниже.

---

### Какой метод выбрать?

| Ситуация | Рекомендуемый метод |
|----------|---------------------|
| Вы с друзьями, у всех Windows, нет навыков | **Radmin VPN** — самый простой, нет регистрации |
| Вы с 1-2 друзьями, все платформы | **Tailscale** — самый надёжный, работает везде |
| Много друзей (до 25), все платформы | **ZeroTier** — больше устройств на бесплатном тарифе |
| Ты один, хочешь зайти с работы/телефона | **Cloudflare Tunnel** — один URL, ничего не ставить друзьям |
| Разовый тест, показать другу на 10 минут | **ngrok** — быстро, но URL меняется |
| У тебя есть доступ к роутеру, хочешь максимум скорости | **Port Forwarding** — без посредников, но сложнее |

---

### 1. Radmin VPN (рекомендация для новичков)

**Что это:** Программа, которая создаёт "виртуальную локальную сеть" через интернет. Как Hamachi, но проще.

**Почему он:** Не нужна регистрация, не нужно лезть в роутер, всё на русском.

#### Шаг 1 — Установка (все участники)

1. Каждый скачивает Radmin VPN с [radmin-vpn.com](https://www.radmin-vpn.com/).
2. Устанавливаем (Next → Next → Finish).
3. При первом запуске программа спросит имя компьютера — введи любое (например, "VasyaPC").

#### Шаг 2 — Создание сети (только хост)

1. В Radmin VPN нажми кнопку **"Сеть"** (Network) в верхнем меню.
2. Выбери **"Создать сеть"** (Create Network).
3. Заполни:
   - **Имя сети** (Network name): например, `DT_Vasya`
   - **Пароль** (Password): придумай простой, например `12345`
   - **Количество участников**: оставь по умолчанию
4. Нажми **"Создать"**.
5. **Запиши** имя сети и пароль — их нужно будет передать друзьям.

#### Шаг 3 — Подключение к сети (все гости)

1. В Radmin VPN нажми **"Сеть" → "Присоединиться к сети"** (Join Network).
2. Введи:
   - **Имя сети**: `DT_Vasya`
   - **Пароль**: `12345`
3. Нажми **"Присоединиться"**.
4. Через 5-10 секунд в списке появится сеть и участники. У хоста будет зелёный значок.

#### Шаг 4 — Запуск DoubleTrouble

1. **Хост** запускает DoubleTrouble: `python run.py`.
2. **Хост** смотрит в Radmin VPN свой IP в этой сети (обычно начинается на `26.x.x.x`, например `26.12.34.56`).
   - Найди свою строку в списке сети → колонка IP.
3. **Все** (включая хост) открывают в браузере:

```text
http://26.12.34.56:8017
```

> **Важно:** именно IP из Radmin VPN, а не `127.0.0.1` и не локальный `192.168.x.x`!

#### Если не работает

| Симптом | Решение |
|---------|---------|
| В Radmin VPN красный значок | Проверь, что хост тоже запустил Radmin VPN и создал сеть |
| Страница не открывается по VPN-IP | Убедись, что `python run.py` запущен и в консоли нет ошибок. Проверь `config/config.yaml`: `listen_ip: 0.0.0.0`, `allow_external_connections: true` |
| Открывается, но очень медленно | Проверь скорость интернета у хоста. Закрой торренты и стримы. |
| Антивирус ругается | Добавь Radmin VPN в исключения антивируса |

> ✅ Скорость до 100 Мбит/с, бесплатно, без лимита участников, работает на Windows.

---

### 2. Tailscale (рекомендация для надежности)

**Что это:** Профессиональная VPN, которая работает на всех устройствах (Windows, Linux, macOS, Android, iOS). Создаёт зашифрованную сеть между устройствами.

**Почему он:** Работает даже если у тебя "серый" IP (CGNAT), не требует настройки роутера, максимально стабильный.

#### Шаг 1 — Регистрация и установка (все участники)

1. Зайди на [tailscale.com](https://tailscale.com/) → **"Get Started"**.
2. Зарегистрируйся через Google, Microsoft или GitHub (проще через Google).
3. Скачай клиент для своей ОС и установи.
4. При запуске войди под тем же аккаунтом.
5. **Повтори для всех участников** — или пригласи их через "Invite users" в веб-панели.

#### Шаг 2 — Проверка сети

1. Открой [login.tailscale.com/admin](https://login.tailscale.com/admin) в браузере.
2. Ты увидишь список всех подключённых устройств.
3. У каждого устройства есть IP, начинающийся на `100.x.x.x`.
4. **Запомни IP хоста** (например, `100.64.12.34`).

#### Шаг 3 — Запуск

1. **Хост** запускает DoubleTrouble: `python run.py`.
2. **Все** открывают в браузере:

```text
http://100.64.12.34:8017
```

#### Если не работает

| Симптом | Решение |
|---------|---------|
| Устройство "Offline" в панели Tailscale | Перезапусти приложение Tailscale на устройстве |
| Страница не открывается | Проверь брандмауэр Windows — разреши Tailscale и Python. Убедись, что `allow_external_connections: true` |
| Tailscale не ставится на телефон | На Android/iOS скачай из магазина, войди под тем же Google-аккаунтом |

> ✅ Бесплатно до 3 пользователей и 100 устройств. Работает через NAT и firewall без настройки. Можно использовать с телефона.

---

### 3. ZeroTier

**Что это:** Ещё одна виртуальная LAN. Хороша, если у вас больше 3 человек (бесплатный Tailscale ограничен 3 юзерами).

#### Шаг 1 — Создание сети (только хост)

1. Зарегистрируйся на [my.zerotier.com](https://my.zerotier.com/).
2. Нажми **"Create A Network"** (синяя кнопка сверху).
3. Откроется страница сети. Скопируй **Network ID** — это длинная строка вроде `af78bf94364d1e2c`.
4. В настройках сети (внизу страницы) найди **"IPv4 Auto-Assign"** и выбери любой диапазон (например, `192.168.192.x`).
5. **Сохрани изменения** (Save).

#### Шаг 2 — Подключение (все участники)

1. Скачай ZeroTier с [zerotier.com/download](https://www.zerotier.com/download/).
2. После установки появится значок ZeroTier в трее (Windows) или в меню (Linux).
3. Кликни по значку → **"Join Network"** → вставь **Network ID** → OK.
4. **Хост** заходит на [my.zerotier.com](https://my.zerotier.com/), открывает свою сеть.
5. В списке "Members" появятся новые устройства. Нажми галочку **"Auth?"** напротив каждого, чтобы одобрить.
6. После одобрения устройствам присвоятся IP (например, `192.168.192.10`).

#### Шаг 3 — Запуск

1. **Хост** запускает DoubleTrouble: `python run.py`.
2. **Хост** смотрит свой ZeroTier IP в веб-панели.
3. **Все** открывают:

```text
http://192.168.192.10:8017
```

> ✅ Бесплатно до 25 устройств. Гостям не нужна регистрация — только Network ID.

---

### 4. Открытие портов на роутере (Port Forwarding)

**Что это:** Ты говоришь роутеру: "если кто-то из интернета стучится на порт 8017 — перекидывай это на мой компьютер".

**Когда использовать:** Если у тебя есть доступ к роутеру, и ты хочешь максимальную скорость без посредников.

**Важно:** Не все провайдеры дают "белый" (публичный) IP. Если у тебя "серый" IP (CGNAT) — этот способ **не сработает**. Проверь: зайди на [2ip.ru](https://2ip.ru) — если IP начинается на `100.x`, `10.x`, `172.16-31.x`, `192.168.x` — у тебя серый IP, используй VPN.

#### Шаг 1 — Узнай локальный IP

**Windows:**
1. Нажми `Win + R` → напиши `cmd` → Enter.
2. В чёрном окне напиши: `ipconfig`
3. Найди секцию с твоим основным адаптером (обычно "Ethernet adapter" или "Wireless LAN adapter").
4. Запиши **IPv4 Address** — это твой локальный IP (например, `192.168.1.25`).

```text
   IPv4 Address. . . . . . . . . . . : 192.168.1.25
```

**Linux:**
```bash
ip addr
```
Ищи строку `inet` на твоём основном интерфейсе (не `lo`).

#### Шаг 2 — Зайди в роутер

1. Открой браузер.
2. В адресной строке напиши один из адресов:
   - `192.168.1.1`
   - `192.168.0.1`
   - `10.0.0.1`
3. Появится окно входа. Логин/пароль обычно:
   - `admin` / `admin`
   - `admin` / `password`
   - или написаны на наклейке на роутере.

#### Шаг 3 — Настрой Port Forwarding

Интерфейс у каждого роутера свой, но общий принцип:

1. Найди раздел с названием:
   - **Port Forwarding**
   - **Virtual Servers**
   - **NAT**
   - **Переадресация портов**
   - **Межсетевой экран → Виртуальные серверы**
2. Нажми **"Добавить"** (Add).
3. Заполни поля:
   - **Service name / Имя:** `DoubleTrouble`
   - **External port / Внешний порт:** `8017`
   - **Internal port / Внутренний порт:** `8017`
   - **Internal IP / IP-адрес:** `192.168.1.25` (твой локальный IP из Шага 1)
   - **Protocol / Протокол:** `TCP` (или `TCP/UDP`)
4. **Сохрани** (Save / Apply).

#### Шаг 4 — Проверь внешний IP

1. Зайди на [2ip.ru](https://2ip.ru) с компьютера, где запущен сервер.
2. Запиши показанный IP (например, `85.123.45.67`).
3. Друзья заходят:

```text
http://85.123.45.67:8017
```

#### Шаг 5 — Проверка

Попроси друга открыть ссылку. Если не открывается:

1. **Windows Firewall:**
   - `Win + R` → `firewall.cpl` → "Разрешение взаимодействия с приложениями".
   - Найди Python → поставь галочки на "Частная" сеть.
2. **Антивирус:** добавь Python и порт 8017 в исключения.
3. **Проверь, что сервер работает:** открой `http://127.0.0.1:8017` на своём ПК.

> ⚠️ Внешний IP может меняться при каждой перезагрузке роутера. Чтобы не менять ссылку друзьям, настрой DDNS (No-IP, Duck DNS) — бесплатно.

---

### 5. ngrok (быстрый тест)

**Что это:** Внешний сервер даёт тебе временный HTTPS-URL. Друг открывает ссылку — ngrok пересылает запрос на твой локальный ПК.

**Когда использовать:** Показать другу "прямо сейчас" на 10 минут, без установки программ у него.

#### Шаг 1 — Регистрация

1. Зайди на [ngrok.com](https://ngrok.com/) → Sign Up.
2. После регистрации открой [Dashboard → Your Authtoken](https://dashboard.ngrok.com/get-started/your-authtoken).
3. Скопируй токен (длинная строка).

#### Шаг 2 — Установка и запуск

**Windows:**
1. Скачай ngrok для Windows с сайта (ZIP-архив).
2. Распакуй ZIP в папку (например, `C:\ngrok`).
3. Открой PowerShell → `cd C:\ngrok`.
4. Авторизуйся (один раз):

```powershell
.\ngrok.exe config add-authtoken <ТВОЙ-ТОКЕН>
```

5. Запусти туннель:

```powershell
.\ngrok.exe http 8017
```

**Linux:**
```bash
# Установка
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar xvzf ngrok-v3-stable-linux-amd64.tgz

# Авторизация (один раз)
./ngrok config add-authtoken <ТВОЙ-ТОКЕН>

# Запуск
./ngrok http 8017
```

#### Шаг 3 — Дай ссылку другу

В терминале появится таблица:

```text
Forwarding  https://abc123-def.ngrok-free.app -> http://localhost:8017
```

Скопируй `https://...` ссылку и отправь другу. Он открывает её в браузере — и попадает на твой DoubleTrouble.

> ⚠️ Бесплатный тариф: URL меняется при каждом запуске ngrok. Ссылка работает, пока запущен ngrok.

---

### 6. Cloudflare Tunnel (быстрый туннель без регистрации)

**Что это:** То же самое, что ngrok, но вообще без регистрации. Одна команда — и у тебя есть публичный URL.

**Когда использовать:** Ещё быстрее, чем ngrok. Не нужно регистрироваться.

#### Шаг 1 — Установка

**Windows:**
1. Скачай `cloudflared` с [developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel/](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel/).
2. Распакуй в папку (например, `C:\cloudflared`).

**Linux:**
```bash
# Debian/Ubuntu
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Другие дистрибутивы — смотри инструкцию на сайте Cloudflare
```

#### Шаг 2 — Запуск

**Windows (PowerShell):**
```powershell
cd C:\cloudflared
.\cloudflared.exe tunnel --url http://localhost:8017
```

**Linux:**
```bash
cloudflared tunnel --url http://localhost:8017
```

#### Шаг 3 — Дай ссылку

В терминале появится:

```text
2024-XX-XX ... INF |  https://random-name.trycloudflare.com
```

Скопируй `https://random-name.trycloudflare.com` и отправь другу.

> ⚠️ URL случайный, ограничение ~200 одновременных запросов, работает пока запущена программа. Не подходит для долгосрочного использования.

---

### Итоговое сравнение

| Способ | Сложность | Нужен аккаунт | Скорость | Постоянный адрес | Бесплатно |
|--------|-----------|---------------|----------|------------------|-----------|
| Radmin VPN | ⭐ Легко | Нет | Хорошая | Да | Да |
| Tailscale | ⭐ Легко | Да | Отличная | Да | Да (до 3 чел.) |
| ZeroTier | ⭐⭐ Средне | Да (только хост) | Хорошая | Да | Да (до 25 устр.) |
| Port Forwarding | ⭐⭐⭐ Сложно | Нет | Максимальная | Да (с DDNS) | Да |
| ngrok | ⭐ Легко | Да | Хорошая | Нет | Да (URL меняется) |
| Cloudflare Tunnel | ⭐ Легко | Нет | Хорошая | Нет | Да (URL меняется) |

> **Для новичков:** начни с **Radmin VPN** (если все на Windows) или **Tailscale** (если разные ОС). Для быстрого показа — **Cloudflare Tunnel**.

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

If you and your friends are in different cities or don't share a Wi-Fi network, you need a way to connect your computers over the internet. Below are all the methods — from the easiest (VPN) to the most advanced (port forwarding).

> **Important:** before starting, make sure `config/config.yaml` has `listen_ip: 0.0.0.0` and `allow_external_connections: true`.

---

### How it works (in plain English)

```
┌─────────────────┐                      ┌─────────────────┐
│   Your PC       │      Internet        │   Friend's PC   │
│ (DoubleTrouble) │  ◄────────────────►  │   (Browser)     │
│  IP: 192.168.x  │                      │  IP: 192.168.y  │
└─────────────────┘                      └─────────────────┘
         │                                        │
         └────────── ❌ DO NOT connect directly ──┘
```

Your computers at home sit **behind a router** (NAT). Each has a "local" IP (`192.168.x.x`), but on the internet they share one "public" IP of the router. So your friend can't just type your IP and connect — the router doesn't know which computer to forward the request to.

**Solutions:**
- **VPN** (Radmin, Tailscale, ZeroTier) — creates a "virtual local network" where everyone gets direct IP addresses inside the VPN.
- **Port Forwarding** — you tell the router: "send all requests on port 8017 to my PC".
- **Tunnels** (ngrok, Cloudflare) — an external server gives you a temporary public URL that leads to your PC.

---

### Preliminary check

Before trying to connect a friend, make sure DoubleTrouble **already works locally**:

1. Start the server: `python run.py`
2. Open on **your own** PC: `http://127.0.0.1:8017` — the app page should load.
3. Find your local IP:
   - **Windows:** open PowerShell → `ipconfig` → look for `IPv4 Address` (e.g., `192.168.1.25`).
   - **Linux/Termux:** `ip addr` or `hostname -I`.
4. Open on **another device** on the same Wi-Fi: `http://<YOUR-LOCAL-IP>:8017` (e.g., `http://192.168.1.25:8017`).
   - If it loads — Wi-Fi/LAN mode works.
   - If **it doesn't** — check Windows Firewall or `allow_external_connections: true` in the config.

> Only after this proceed to the methods below.

---

### Which method to choose?

| Situation | Recommended method |
|-----------|-------------------|
| You + friends, all on Windows, no tech skills | **Radmin VPN** — simplest, no registration |
| You + 1-2 friends, mixed platforms | **Tailscale** — most reliable, works everywhere |
| Many friends (up to 25), mixed platforms | **ZeroTier** — more devices on free tier |
| Just you, want to access from work/phone | **Cloudflare Tunnel** — one URL, nothing to install for friends |
| One-time test, show a friend for 10 minutes | **ngrok** — fast but URL changes |
| You have router access, want max speed | **Port Forwarding** — no middlemen but harder |

---

### 1. Radmin VPN (recommended for beginners)

**What it is:** A program that creates a "virtual local network" over the internet. Like Hamachi, but simpler.

**Why use it:** No registration needed, no router config, interface is in English/Russian.

#### Step 1 — Installation (all participants)

1. Everyone downloads Radmin VPN from [radmin-vpn.com](https://www.radmin-vpn.com/).
2. Install it (Next → Next → Finish).
3. On first launch, it asks for a computer name — enter anything (e.g., "MikePC").

#### Step 2 — Create a network (host only)

1. In Radmin VPN, click **"Network"** in the top menu.
2. Select **"Create Network"**.
3. Fill in:
   - **Network name:** e.g., `DT_Mike`
   - **Password:** anything simple, e.g., `12345`
   - **Participants:** leave default
4. Click **"Create"**.
5. **Write down** the network name and password — you will send them to friends.

#### Step 3 — Join the network (all guests)

1. In Radmin VPN, click **"Network" → "Join Network"**.
2. Enter:
   - **Network name:** `DT_Mike`
   - **Password:** `12345`
3. Click **"Join"**.
4. After 5-10 seconds the network and participants appear in the list. The host will have a green icon.

#### Step 4 — Launch DoubleTrouble

1. **Host** starts DoubleTrouble: `python run.py`.
2. **Host** checks their IP in this network inside Radmin VPN (usually starts with `26.x.x.x`, e.g. `26.12.34.56`).
   - Find your row in the network list → IP column.
3. **Everyone** (including host) opens in their browser:

```text
http://26.12.34.56:8017
```

> **Important:** use the IP from Radmin VPN, not `127.0.0.1` and not local `192.168.x.x`!

#### If it doesn't work

| Symptom | Solution |
|---------|----------|
| Red icon in Radmin VPN | Make sure the host also launched Radmin VPN and created the network |
| Page won't open via VPN IP | Make sure `python run.py` is running and the console shows no errors. Check `config/config.yaml`: `listen_ip: 0.0.0.0`, `allow_external_connections: true` |
| Opens but very slow | Check the host's internet speed. Close torrents and streams |
| Antivirus complains | Add Radmin VPN to antivirus exclusions |

> ✅ Speed up to 100 Mbps, free, unlimited participants, works on Windows.

---

### 2. Tailscale (recommended for reliability)

**What it is:** A professional VPN that works on all devices (Windows, Linux, macOS, Android, iOS). Creates an encrypted network between devices.

**Why use it:** Works even if you have a "gray" IP (CGNAT), requires no router setup, maximally stable.

#### Step 1 — Sign up and install (all participants)

1. Go to [tailscale.com](https://tailscale.com/) → **"Get Started"**.
2. Sign up with Google, Microsoft, or GitHub (Google is easiest).
3. Download the client for your OS and install.
4. On launch, log in with the same account.
5. **Repeat for all participants** — or invite them via "Invite users" in the web panel.

#### Step 2 — Check the network

1. Open [login.tailscale.com/admin](https://login.tailscale.com/admin) in a browser.
2. You will see a list of all connected devices.
3. Each device has an IP starting with `100.x.x.x`.
4. **Remember the host's IP** (e.g., `100.64.12.34`).

#### Step 3 — Launch

1. **Host** starts DoubleTrouble: `python run.py`.
2. **Everyone** opens in their browser:

```text
http://100.64.12.34:8017
```

#### If it doesn't work

| Symptom | Solution |
|---------|----------|
| Device shows "Offline" in Tailscale panel | Restart the Tailscale app on that device |
| Page won't open | Check Windows Firewall — allow Tailscale and Python. Make sure `allow_external_connections: true` |
| Tailscale won't install on phone | On Android/iOS download from the store and log in with the same Google account |

> ✅ Free for up to 3 users and 100 devices. Works through NAT and firewall without setup. Can be used from a phone.

---

### 3. ZeroTier

**What it is:** Another virtual LAN. Good if you have more than 3 people (free Tailscale is limited to 3 users).

#### Step 1 — Create a network (host only)

1. Sign up at [my.zerotier.com](https://my.zerotier.com/).
2. Click **"Create A Network"** (blue button at the top).
3. The network page opens. Copy the **Network ID** — a long string like `af78bf94364d1e2c`.
4. In network settings (bottom of the page), find **"IPv4 Auto-Assign"** and pick any range (e.g., `192.168.192.x`).
5. **Save** changes.

#### Step 2 — Connect (all participants)

1. Download ZeroTier from [zerotier.com/download](https://www.zerotier.com/download/).
2. After installation, a ZeroTier icon appears in the tray (Windows) or menu (Linux).
3. Click the icon → **"Join Network"** → paste the **Network ID** → OK.
4. **Host** goes to [my.zerotier.com](https://my.zerotier.com/), opens their network.
5. In the "Members" list, new devices appear. Check the **"Auth?"** box next to each to approve.
6. After approval, devices get assigned IPs (e.g., `192.168.192.10`).

#### Step 3 — Launch

1. **Host** starts DoubleTrouble: `python run.py`.
2. **Host** checks their ZeroTier IP in the web panel.
3. **Everyone** opens:

```text
http://192.168.192.10:8017
```

> ✅ Free for up to 25 devices. Guests don't need to register — just the Network ID.

---

### 4. Port Forwarding on your router

**What it is:** You tell the router: "if someone from the internet knocks on port 8017, forward it to my computer".

**When to use:** If you have router access and want maximum speed without intermediaries.

**Important:** Not all ISPs give you a "white" (public) IP. If you have a "gray" IP (CGNAT) this method **will not work**. Check: go to [2ip.ru](https://2ip.ru) — if the IP starts with `100.x`, `10.x`, `172.16-31.x`, or `192.168.x`, you have a gray IP. Use a VPN instead.

#### Step 1 — Find your local IP

**Windows:**
1. Press `Win + R` → type `cmd` → Enter.
2. In the black window type: `ipconfig`
3. Find the section for your main adapter (usually "Ethernet adapter" or "Wireless LAN adapter").
4. Write down **IPv4 Address** — this is your local IP (e.g., `192.168.1.25`).

```text
   IPv4 Address. . . . . . . . . . . : 192.168.1.25
```

**Linux:**
```bash
ip addr
```
Look for the `inet` line on your main interface (not `lo`).

#### Step 2 — Log into your router

1. Open a browser.
2. In the address bar type one of these addresses:
   - `192.168.1.1`
   - `192.168.0.1`
   - `10.0.0.1`
3. A login window appears. Default credentials are usually:
   - `admin` / `admin`
   - `admin` / `password`
   - or written on a sticker on the router.

#### Step 3 — Configure Port Forwarding

Every router interface is different, but the general principle:

1. Find a section named:
   - **Port Forwarding**
   - **Virtual Servers**
   - **NAT**
   - **Переадресация портов** (on Russian firmware)
   - **Firewall → Virtual Servers**
2. Click **"Add"** (Add).
3. Fill in the fields:
   - **Service name / Имя:** `DoubleTrouble`
   - **External port / Внешний порт:** `8017`
   - **Internal port / Внутренний порт:** `8017`
   - **Internal IP / IP-адрес:** `192.168.1.25` (your local IP from Step 1)
   - **Protocol / Протокол:** `TCP` (or `TCP/UDP`)
4. **Save** (Save / Apply).

#### Step 4 — Check your public IP

1. Go to [2ip.ru](https://2ip.ru) from the computer running the server.
2. Write down the displayed IP (e.g., `85.123.45.67`).
3. Friends connect to:

```text
http://85.123.45.67:8017
```

#### Step 5 — Troubleshooting

Ask a friend to open the link. If it doesn't work:

1. **Windows Firewall:**
   - `Win + R` → `firewall.cpl` → "Allow an app through Windows Firewall".
   - Find Python → check "Private" network boxes.
2. **Antivirus:** add Python and port 8017 to exclusions.
3. **Make sure the server is running:** open `http://127.0.0.1:8017` on your own PC.

> ⚠️ Your public IP may change every time the router reboots. To avoid changing the link for friends, set up DDNS (No-IP, Duck DNS) — it's free.

---

### 5. ngrok (quick test)

**What it is:** An external server gives you a temporary HTTPS URL. Your friend opens the link — ngrok forwards the request to your local PC.

**When to use:** Show a friend "right now" for 10 minutes, without installing anything on their side.

#### Step 1 — Sign up

1. Go to [ngrok.com](https://ngrok.com/) → Sign Up.
2. After registration, open [Dashboard → Your Authtoken](https://dashboard.ngrok.com/get-started/your-authtoken).
3. Copy the token (long string).

#### Step 2 — Install and run

**Windows:**
1. Download ngrok for Windows from the website (ZIP archive).
2. Extract ZIP to a folder (e.g., `C:\ngrok`).
3. Open PowerShell → `cd C:\ngrok`.
4. Authenticate (one time):

```powershell
.\ngrok.exe config add-authtoken <YOUR-TOKEN>
```

5. Start the tunnel:

```powershell
.\ngrok.exe http 8017
```

**Linux:**
```bash
# Install
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar xvzf ngrok-v3-stable-linux-amd64.tgz

# Authenticate (one time)
./ngrok config add-authtoken <YOUR-TOKEN>

# Run
./ngrok http 8017
```

#### Step 3 — Share the link with your friend

In the terminal a table appears:

```text
Forwarding  https://abc123-def.ngrok-free.app -> http://localhost:8017
```

Copy the `https://...` link and send it to your friend. They open it in a browser and land on your DoubleTrouble.

> ⚠️ Free tier: URL changes on every ngrok launch. The link works only while ngrok is running.

---

### 6. Cloudflare Tunnel (quick tunnel, no registration)

**What it is:** Same as ngrok, but with no registration at all. One command — and you have a public URL.

**When to use:** Even faster than ngrok. No sign-up needed.

#### Step 1 — Install

**Windows:**
1. Download `cloudflared` from [developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel/](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel/).
2. Extract to a folder (e.g., `C:\cloudflared`).

**Linux:**
```bash
# Debian/Ubuntu
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Other distros — see Cloudflare docs
```

#### Step 2 — Run

**Windows (PowerShell):**
```powershell
cd C:\cloudflared
.\cloudflared.exe tunnel --url http://localhost:8017
```

**Linux:**
```bash
cloudflared tunnel --url http://localhost:8017
```

#### Step 3 — Share the link

In the terminal you will see:

```text
2024-XX-XX ... INF |  https://random-name.trycloudflare.com
```

Copy `https://random-name.trycloudflare.com` and send it to your friend.

> ⚠️ Random URL, ~200 concurrent request limit, works while the program is running. Not suitable for long-term use.

---

### Final comparison

| Method | Difficulty | Account needed | Speed | Permanent address | Free |
|--------|-----------|----------------|-------|-------------------|------|
| Radmin VPN | ⭐ Easy | No | Good | Yes | Yes |
| Tailscale | ⭐ Easy | Yes | Excellent | Yes | Yes (up to 3 users) |
| ZeroTier | ⭐⭐ Medium | Yes (host only) | Good | Yes | Yes (up to 25 devices) |
| Port Forwarding | ⭐⭐⭐ Hard | No | Maximum | Yes (with DDNS) | Yes |
| ngrok | ⭐ Easy | Yes | Good | No | Yes (URL changes) |
| Cloudflare Tunnel | ⭐ Easy | No | Good | No | Yes (URL changes) |

> **For beginners:** start with **Radmin VPN** (if everyone is on Windows) or **Tailscale** (if mixed OS). For a quick demo — **Cloudflare Tunnel**.

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
