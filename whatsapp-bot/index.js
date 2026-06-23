const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const http = require('http');
const fs   = require('fs');
const path = require('path');

// Chromium leaves lock files behind when a container is killed/restarted.
// Remove them before launching so the browser starts cleanly.
const AUTH_DATA_PATH = '/app/.wwebjs_auth';
const CHROMIUM_LOCKS = new Set(['SingletonLock', 'SingletonCookie', 'SingletonSocket']);

function removeChromiumLocks(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            removeChromiumLocks(full);
        } else if (CHROMIUM_LOCKS.has(entry.name)) {
            fs.unlinkSync(full);
            console.log(`Removed stale lock: ${full}`);
        }
    }
}

removeChromiumLocks(AUTH_DATA_PATH);

const PORT = process.env.PORT || 3001;
let clientReady = false;

const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', ready: clientReady }));
    } else {
        res.writeHead(404);
        res.end();
    }
});
server.listen(PORT, () => console.log(`Health endpoint listening on :${PORT}/health`));

// ─── State names ────────────────────────────────────────────────────────────
const S = {
    IDLE:           'IDLE',
    MAIN_MENU:      'MAIN_MENU',
    INCIDENT_TYPE:  'INCIDENT_TYPE',   // Step 1 – matches Survey top selector
    INFRASTRUCTURE: 'INFRASTRUCTURE',  // Step 2 – Survey Slide 1 (multi-select)
    INFRA_OTHER:    'INFRA_OTHER',     //         sub-step when "other" chosen
    INFRA_NAME:     'INFRA_NAME',      // Step 3 – Survey Slide 2
    INFRA_COUNT:    'INFRA_COUNT',     // Step 4 – Survey Slide 3
    DAMAGE_CLASS:   'DAMAGE_CLASS',    // Step 5 – Survey Slide 4
    DEBRIS:         'DEBRIS',          // Step 6 – Survey Slide 5
    LOCATION:       'LOCATION',        // Step 7 – Survey Slide 6 (WhatsApp location)
    DESCRIPTION:    'DESCRIPTION',     // Step 8 – Survey Slide 7 (optional)
    PHOTO:          'PHOTO',           // Step 9 – Survey Slide 8 (WhatsApp image)
    CONFIRM:        'CONFIRM',
};

// ─── Survey option tables (mirrors Survey.tsx values) ────────────────────────
const INCIDENT_TYPES = ['earthquake', 'wildfire', 'flood', 'landslide'];

const INFRA_OPTIONS = [
    { value: 'residential', label: 'Residential Building',    desc: 'Homes, apartments' },
    { value: 'commercial',  label: 'Commercial Building',     desc: 'Shops, offices' },
    { value: 'government',  label: 'Government Facility',     desc: 'Offices, courts' },
    { value: 'utility',     label: 'Utility Infrastructure',  desc: 'Power, water, telecom' },
    { value: 'transport',   label: 'Transport Infrastructure',desc: 'Roads, bridges, rail' },
    { value: 'community',   label: 'Community Facility',      desc: 'Schools, clinics' },
    { value: 'recreation',  label: 'Recreation Facility',     desc: 'Parks, stadiums' },
    { value: 'other',       label: 'Other',                   desc: '' },
];

const COUNT_OPTIONS = ['1', '2 - 5', '6 - 20', 'More than 20'];

const DAMAGE_OPTIONS = [
    { value: 'minimal',  label: 'Minimal',  desc: 'Minor damage, structure still functional' },
    { value: 'partial',  label: 'Partial',  desc: 'Significant damage, partially functional' },
    { value: 'complete', label: 'Complete', desc: 'Total destruction, not functional' },
];

// ─── Per-user session store ──────────────────────────────────────────────────
const sessions = new Map();

function getSession(chatId) {
    if (!sessions.has(chatId)) sessions.set(chatId, { state: S.IDLE, data: {} });
    return sessions.get(chatId);
}

function resetSession(chatId) {
    sessions.set(chatId, { state: S.IDLE, data: {} });
}

// ─── Summary shown before confirm ───────────────────────────────────────────
function buildSummary(data) {
    const infra = (data.infrastructure ?? [])
        .map(v => INFRA_OPTIONS.find(o => o.value === v)?.label ?? v)
        .join(', ') || 'N/A';

    const damage = DAMAGE_OPTIONS.find(o => o.value === data.damageClass)?.label ?? 'N/A';

    const loc = data.location
        ? `${data.location.latitude.toFixed(5)}, ${data.location.longitude.toFixed(5)}${data.location.description ? ' (' + data.location.description + ')' : ''}`
        : 'N/A';

    return `*📋 Report Summary*

🌍 *Incident Type:*  ${data.incidentType ?? 'N/A'}
🏗️ *Infrastructure:* ${infra}${data.otherText ? ` (${data.otherText})` : ''}
🏢 *Name / ID:*      ${data.infraName || '—'}
🔢 *Count:*          ${data.infraCount ?? 'N/A'}
⚠️ *Damage Level:*  ${damage}
🪨 *Debris:*         ${data.debris ?? 'N/A'}
📍 *Location:*       ${loc}
📝 *Description:*    ${data.description || '—'}
📸 *Photo:*          ${data.photo ? '✅ Attached' : 'None'}

Reply *yes* to submit or *no* to cancel.`;
}

// ─── WhatsApp client ─────────────────────────────────────────────────────────
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: AUTH_DATA_PATH }),
    puppeteer: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
        ],
    },
});

client.on('qr', (qr) => {
    console.log('\n=== Scan this QR code in WhatsApp (Linked Devices) ===\n');
    qrcode.generate(qr, { small: true });
    console.log('\n======================================================\n');
});

client.on('authenticated', () => console.log('Authenticated — session saved.'));

client.on('ready', () => {
    clientReady = true;
    console.log('Bot is ready and listening for messages.');
});

client.on('auth_failure', (msg) => console.error('Authentication failed:', msg));

client.on('disconnected', (reason) => {
    clientReady = false;
    console.log('Disconnected:', reason);
});

// ─── Message handler ─────────────────────────────────────────────────────────
async function handleMessage(msg) {
    if (msg.fromMe) return;

    const chatId = msg.from;
    const sess   = getSession(chatId);
    const text   = (msg.body ?? '').toLowerCase().trim();

    // Global cancel — works from any state except IDLE
    if (text === 'cancel' && sess.state !== S.IDLE) {
        resetSession(chatId);
        await msg.reply('❌ Report cancelled. Type *hey* to start again.');
        return;
    }

    switch (sess.state) {

        // ── Entry ──────────────────────────────────────────────────────────
        case S.IDLE: {
            if (['hey', 'hello', 'hi'].includes(text)) {
                sess.state = S.MAIN_MENU;
                await msg.reply(
                    `👋 Hello! Welcome to the *Crisis Mapping Bot*.\n\n` +
                    `What would you like to do?\n\n` +
                    `1️⃣  Report a Crisis\n` +
                    `2️⃣  About This Bot\n\n` +
                    `Reply *1* or *2*. Type *cancel* at any time to start over.`
                );
            } else {
                await msg.reply('Type *hey* to get started.');
            }
            break;
        }

        // ── Main menu ──────────────────────────────────────────────────────
        case S.MAIN_MENU: {
            if (text === '1') {
                sess.state = S.INCIDENT_TYPE;
                await msg.reply(
                    `🚨 *Report a Crisis*\n\n` +
                    `What type of incident is this?\n\n` +
                    `1️⃣  Earthquake\n` +
                    `2️⃣  Wildfire\n` +
                    `3️⃣  Flood\n` +
                    `4️⃣  Landslide\n\n` +
                    `Reply *1*, *2*, *3*, or *4*.`
                );
            } else if (text === '2') {
                resetSession(chatId);
                await msg.reply(
                    `*ℹ️ About Crisis Mapping Bot*\n\n` +
                    `We track and coordinate real-time crisis response:\n` +
                    `• Incident reporting with photo evidence\n` +
                    `• AI-powered image classification\n` +
                    `• Live crisis map\n\n` +
                    `Type *hey* to start again.`
                );
            } else {
                await msg.reply('Please reply *1* to report a crisis or *2* for information about this bot.');
            }
            break;
        }

        // ── Step 1 — Incident type ─────────────────────────────────────────
        case S.INCIDENT_TYPE: {
            const i = parseInt(text, 10) - 1;
            if (i >= 0 && i <= 3) {
                sess.data.incidentType = INCIDENT_TYPES[i];
                sess.state = S.INFRASTRUCTURE;

                const opts = INFRA_OPTIONS
                    .map((o, idx) => `${idx + 1}. ${o.label}${o.desc ? ' — ' + o.desc : ''}`)
                    .join('\n');

                await msg.reply(
                    `🏗️ *Which infrastructure was affected?* _(Step 2 of 9)_\n\n` +
                    `${opts}\n\n` +
                    `Reply with one or more numbers separated by commas (e.g. *1, 3, 5*).\n` +
                    `Multiple selections allowed.`
                );
            } else {
                await msg.reply('Please reply with a number between *1* and *4*.');
            }
            break;
        }

        // ── Step 2 — Infrastructure (multi-select) ─────────────────────────
        case S.INFRASTRUCTURE: {
            const indices = text
                .split(/[,\s]+/)
                .map(n => parseInt(n.trim(), 10) - 1)
                .filter(i => i >= 0 && i < INFRA_OPTIONS.length);

            if (indices.length === 0) {
                await msg.reply('Please reply with at least one number (1–8). Multiple allowed, e.g. *1, 3, 5*.');
                break;
            }

            // Deduplicate, preserve order
            sess.data.infrastructure = [...new Set(indices)].map(i => INFRA_OPTIONS[i].value);

            if (sess.data.infrastructure.includes('other')) {
                sess.state = S.INFRA_OTHER;
                await msg.reply('You selected *Other*. Please describe the type of infrastructure:');
            } else {
                sess.state = S.INFRA_NAME;
                await msg.reply(
                    `🏢 *Name of the affected infrastructure* _(Step 3 of 9)_\n\n` +
                    `What is the name or identifier?\n` +
                    `_(e.g. "Nairobi General Hospital", "A2 Bridge KM 45")_\n\n` +
                    `Type *skip* to leave blank.`
                );
            }
            break;
        }

        // ── Step 2b — "Other" infrastructure description ───────────────────
        case S.INFRA_OTHER: {
            sess.data.otherText = msg.body.trim();
            sess.state = S.INFRA_NAME;
            await msg.reply(
                `🏢 *Name of the affected infrastructure* _(Step 3 of 9)_\n\n` +
                `What is the name or identifier?\n\n` +
                `Type *skip* to leave blank.`
            );
            break;
        }

        // ── Step 3 — Infrastructure name ──────────────────────────────────
        case S.INFRA_NAME: {
            sess.data.infraName = text === 'skip' ? '' : msg.body.trim();
            sess.state = S.INFRA_COUNT;
            await msg.reply(
                `🔢 *How many structures were affected?* _(Step 4 of 9)_\n\n` +
                `1️⃣  1\n` +
                `2️⃣  2 – 5\n` +
                `3️⃣  6 – 20\n` +
                `4️⃣  More than 20\n\n` +
                `Reply *1*, *2*, *3*, or *4*.`
            );
            break;
        }

        // ── Step 4 — Count ────────────────────────────────────────────────
        case S.INFRA_COUNT: {
            const i = parseInt(text, 10) - 1;
            if (i >= 0 && i <= 3) {
                sess.data.infraCount = COUNT_OPTIONS[i];
                sess.state = S.DAMAGE_CLASS;

                const opts = DAMAGE_OPTIONS
                    .map((o, idx) => `${idx + 1}️⃣  *${o.label}* — ${o.desc}`)
                    .join('\n');

                await msg.reply(
                    `⚠️ *Level of Damage* _(Step 5 of 9)_\n\n` +
                    `${opts}\n\n` +
                    `Reply *1*, *2*, or *3*.`
                );
            } else {
                await msg.reply('Please reply with *1*, *2*, *3*, or *4*.');
            }
            break;
        }

        // ── Step 5 — Damage class ─────────────────────────────────────────
        case S.DAMAGE_CLASS: {
            const i = parseInt(text, 10) - 1;
            if (i >= 0 && i <= 2) {
                sess.data.damageClass = DAMAGE_OPTIONS[i].value;
                sess.state = S.DEBRIS;
                await msg.reply(
                    `🪨 *Is there debris blocking access?* _(Step 6 of 9)_\n\n` +
                    `Reply *yes* or *no*.`
                );
            } else {
                await msg.reply('Please reply with *1*, *2*, or *3*.');
            }
            break;
        }

        // ── Step 6 — Debris ───────────────────────────────────────────────
        case S.DEBRIS: {
            if (['yes', 'y', 'no', 'n'].includes(text)) {
                sess.data.debris = text.startsWith('y') ? 'yes' : 'no';
                sess.state = S.LOCATION;
                await msg.reply(
                    `📍 *Share the incident location* _(Step 7 of 9)_\n\n` +
                    `Please share the WhatsApp location of the incident site.\n\n` +
                    `How to share:\n` +
                    `📎 Tap the attachment icon → *Location* → *Send Your Current Location*\n` +
                    `(or search and drop a pin on the map)`
                );
            } else {
                await msg.reply('Please reply *yes* or *no*.');
            }
            break;
        }

        // ── Step 7 — Location (WhatsApp location message) ─────────────────
        case S.LOCATION: {
            if (msg.type === 'location') {
                sess.data.location = {
                    latitude:    msg.location.latitude,
                    longitude:   msg.location.longitude,
                    description: msg.location.description || '',
                };
                sess.state = S.DESCRIPTION;
                await msg.reply(
                    `📝 *Additional description* _(Step 8 of 9 — optional)_\n\n` +
                    `Describe what you saw at the incident site.\n\n` +
                    `Type *skip* to leave blank.`
                );
            } else {
                await msg.reply(
                    `📍 Please *share your location* using WhatsApp's location feature.\n\n` +
                    `Tap the 📎 attachment icon → *Location* → *Send Your Current Location*.`
                );
            }
            break;
        }

        // ── Step 8 — Description (optional) ──────────────────────────────
        case S.DESCRIPTION: {
            sess.data.description = text === 'skip' ? '' : msg.body.trim();
            sess.state = S.PHOTO;
            await msg.reply(
                `📸 *Photo of the damage* _(Step 9 of 9 — optional)_\n\n` +
                `Send a photo of the damage for AI classification.\n\n` +
                `Type *skip* if you don't have one.`
            );
            break;
        }

        // ── Step 9 — Photo (WhatsApp image or skip) ───────────────────────
        case S.PHOTO: {
            if (msg.hasMedia && msg.type === 'image') {
                const media = await msg.downloadMedia();
                sess.data.photo = {
                    mimetype: media.mimetype,
                    filename: media.filename || `photo_${Date.now()}.jpg`,
                    data:     media.data, // base64 — stored in session, not logged
                };
                sess.state = S.CONFIRM;
                await msg.reply(buildSummary(sess.data));
            } else if (text === 'skip') {
                sess.data.photo = null;
                sess.state = S.CONFIRM;
                await msg.reply(buildSummary(sess.data));
            } else {
                await msg.reply(
                    `Please send a *photo* of the damage, or type *skip* to continue without one.`
                );
            }
            break;
        }

        // ── Confirm & submit ──────────────────────────────────────────────
        case S.CONFIRM: {
            if (['yes', 'y'].includes(text)) {
                const report = {
                    from:        chatId,
                    submittedAt: new Date().toISOString(),
                    incidentType: sess.data.incidentType,
                    infrastructure: sess.data.infrastructure,
                    otherText:    sess.data.otherText ?? '',
                    infraName:    sess.data.infraName ?? '',
                    infraCount:   sess.data.infraCount,
                    damageClass:  sess.data.damageClass,
                    debris:       sess.data.debris,
                    location:     sess.data.location ?? null,
                    description:  sess.data.description ?? '',
                    // Only log photo metadata — not the raw base64 bytes
                    photo: sess.data.photo
                        ? { filename: sess.data.photo.filename, mimetype: sess.data.photo.mimetype }
                        : null,
                };

                console.log('\n========== NEW CRISIS REPORT ==========');
                console.log(JSON.stringify(report, null, 2));
                console.log('========================================\n');

                resetSession(chatId);
                await msg.reply(
                    `✅ *Report submitted successfully!*\n\n` +
                    `Thank you. Your incident has been logged and will be reviewed.\n\n` +
                    `Type *hey* to submit another report.`
                );
            } else if (['no', 'n'].includes(text)) {
                resetSession(chatId);
                await msg.reply('❌ Report cancelled. Type *hey* to start again.');
            } else {
                await msg.reply('Please reply *yes* to submit or *no* to cancel.');
            }
            break;
        }

        default:
            resetSession(chatId);
            await msg.reply('Something went wrong. Type *hey* to start over.');
    }
}

client.on('message', handleMessage);

client.initialize();
