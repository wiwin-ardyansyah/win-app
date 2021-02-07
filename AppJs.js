// Memanggil Lib WhatsApp.js
const { Client, MessageMedia } = require('whatsapp-web.js');
// Memanggil Lib Express
const express = require('express');
const { body, validationResult } = require('express-validator');
// Memanggil Lib Socket.io
const socketIO   = require('socket.io');
// Memanggil Lib QrCode
const qrcode     = require('qrcode');
// Memanggil Lib Http
const http       = require('http');
// Memanggil Lib Authentication
const fs         = require('fs');
// Memanggil Lib express-fileupload
const fileUpload         = require('express-fileupload');
// Memanggil Lib axios
const axios = require('axios');

const { response } = require('express');
const { errors } = require('puppeteer');

const app    = express();
const server = http.createServer(app);
const io     = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }))
app.use(fileUpload({
    debug: true,
}));
// Membuat file session whatsapp-session.json secara otomatis
const SESSION_FILE_PATH = './whatsapp-session.json';
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionCfg = require(SESSION_FILE_PATH);
}

app.get('/', (req, res) => {
    res.sendFile('index.html', { root: __dirname });
});

/*puppeteer: { headless: false } Jika false qrcode dibuka menggunakan Browser - jika true qrcode dibuka menggunakan CLI */
const client = new Client({
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
    },
    session: sessionCfg
});


// Info Scan QrCode
client.on('ready', () => {
    console.log('Scan Qr-Code Berhasil...');
});


// Kirim dan balas WhatsApp
client.on('message', async msg => {
    console.log('MESSAGE RECEIVED', msg);
    if (msg.body === '!ping reply') {
        // Send a new message as a reply to the current one
        msg.reply('pong');

    } else if (msg.body === '!menu') {
        let menu =  `*~Ketik nomor dan kirim..~*\n
*1*. Menu-1\n
*2*. Menu-2\n
*3*. Menu-3\n
*4*. Menu-4\n
*5*. Menu-5\n`;
        // Send a new message to the same chat
        client.sendMessage(msg.from, menu);

    }else if (msg.location) {
       const lat = msg.location.latitude
       const lon = msg.location.longitude
        const lokasi = `${lat},${lon}`
        // Send a new message to the same chat
        client.sendMessage(msg.from,lokasi);
        

    } else if (msg.body.startsWith('!sendto ')) {
        // Direct send a new message to specific id
        let number = msg.body.split(' ')[1]; 
        let pesan = msg.body.split(' ')[2]; 
        number = number.includes('@c.us') ? number : `${number}@c.us`;
        let chat = await msg.getChat();
        chat.sendSeen();
        client.sendMessage(number, pesan);
        // client.sendMessage(number, message);

    }  else if (msg.body.startsWith('!echo ')) {
        // Replies with the same message
        msg.reply(msg.body.slice(6));
    } else if (msg.body === '!chats') {
        const chats = await client.getChats();
        client.sendMessage(msg.from, `Bot WA Sudah membuka ${chats.length} chat.`);
    } else if (msg.body === '!info') {
        let info = client.info;
        client.sendMessage(msg.from, `
            *Connection info*
            Nama Pengguna: ${info.pushname}
            Telp. WA: ${info.me.user}
            Platform: ${info.platform}
            Versi WA: ${info.phone.wa_version}
        `);
    } else if (msg.body === '!mediainfo' && msg.hasMedia) {
        const attachmentData = await msg.downloadMedia();
        msg.reply(`
            *Media info*
            MimeType: ${attachmentData.mimetype}
            Filename: ${attachmentData.filename}
            Data (length): ${attachmentData.data.length}
        `);
    } else if (msg.body === '!quoteinfo' && msg.hasQuotedMsg) {
        const quotedMsg = await msg.getQuotedMessage();

        quotedMsg.reply(`
            ID: ${quotedMsg.id._serialized}
            Type: ${quotedMsg.type}
            Author: ${quotedMsg.author || quotedMsg.from}
            Timestamp: ${quotedMsg.timestamp}
            Has Media? ${quotedMsg.hasMedia}
        `);
    } else if (msg.body === '!resendmedia' && msg.hasQuotedMsg) {
        const quotedMsg = await msg.getQuotedMessage();
        if (quotedMsg.hasMedia) {
            const attachmentData = await quotedMsg.downloadMedia();
            client.sendMessage(msg.from, attachmentData, { caption: 'Here\'s your requested media.' });
        }
    } else if (msg.body.startsWith('!status ')) {
        const newStatus = msg.body.split(' ')[1];
        await client.setStatus(newStatus);
        msg.reply(`Status Sudah diganti menjadi *${newStatus}*`);
    } else if (msg.body === '!mention') {
        const contact = await msg.getContact();
        const chat = await msg.getChat();
        chat.sendMessage(`Holla @${contact.number}!`, {
            mentions: [contact]
        });
    } else if (msg.body === '!delete') {
        if (msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
            if (quotedMsg.fromMe) {
                quotedMsg.delete(true);
            } else {
                msg.reply('I can only delete my own messages');
            }
        }
    }else if (msg.body === '!mute') {
        const chat = await msg.getChat();
        // mute the chat for 20 seconds
        const unmuteDate = new Date();
        unmuteDate.setSeconds(unmuteDate.getSeconds() + 20);
        await chat.mute(unmuteDate);
    } else if (msg.body === '!typing') {
        const chat = await msg.getChat();
        // simulates typing in the chat
        chat.sendStateTyping();
    } else if (msg.body === '!recording') {
        const chat = await msg.getChat();
        // simulates recording audio in the chat
        chat.sendStateRecording();
    } else if (msg.body === '!clearstate') {
        const chat = await msg.getChat();
        // stops typing or recording in the chat
        chat.clearState();
    }
});

client.initialize();

// Socket IO
io.on('connection', function (socket) {
    socket.emit('message', 'Menyambungkan...')

    // Membuat QR Code
    client.on('qr', (qr) => {
        console.log('QR RECEIVED', qr);
        qrcode.toDataURL(qr, (err, url) => {
            socket.emit('qr', url);
            socket.emit('message', 'QR_Code diterima silahkan scan..');
        });
    });

    client.on('ready', () => {
        socket.emit('ready', 'WA Sudah Ready..');
        socket.emit('message', 'WA Sudah Ready..');
    });
    
    
    // Menyimpan session QrCode kedalam file whatsapp-session.js
    client.on('authenticated', (session) => {
        socket.emit('ready', 'WA Sudah terotentikasi..');
        socket.emit('terotentikasi', 'WA Sudah terotentikasi..');
        
        console.log('AUTHENTICATED', session);
        sessionCfg=session;
        fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
            if (err) {
                console.error(err);
            }
        });
    });
}); 

// Cek Registrasi notelp
const regTelp = async function (number) {
    const cekRegTelp = await client.isRegisteredUser(number);
    return cekRegTelp;
}


//Kirim pesan
app.post('/send-message', [
    body('number').notEmpty(),
    body('message').notEmpty(),
], async (req, res) => {
        const error = validationResult(req).formatWith(({ msg }) => {
            return msg;
        });

        if (!error.isEmpty()) {
            return res.status(422).json({
                status: false,
                message : error.mapped()
            });
        }
        const number = req.body.number;
        
        
        const formNum = number.replace(/\D/g, '');
        if (formNum.startsWith('0')) {
            formNumber = '62'+formNum.substr(1)
        }
        
        const pars = formNumber.includes('@c.us') ? formNumber : `${formNumber}@c.us`;
        const message = req.body.message;

        // Cek nomor telp/wa terdaftar
        const regNumFix = await regTelp(pars);
        if (!regNumFix) {
            return res.status(422).json({
                status: false,
                message: 'Nomor Telp/WA belum terdaftar'
            });
        }
        

    client.sendMessage(pars, message).then(response => {
        res.status(200).json({
            status: true,
            response: response
        });
    }).catch(err => {
        res.status(500).json({
            status: false,
            response: err
        });
    });
});


//Kirim Media upload
app.post('/send-mediaupload', (req, res) => {  
    const number = req.body.number;
    const caption = req.body.caption;

    const formNum = number.replace(/\D/g, '');

    if (formNum.startsWith('0')) {
        formNumber = '62'+formNum.substr(1)
    }
    
    const pars = formNumber.includes('@c.us') ? formNumber : `${formNumber}@c.us`;
    const file = req.files.file;
    const media = new MessageMedia(file.mimetype, file.data.toString('base64'), file.name)

        client.sendMessage(pars, media, {caption : caption}).then(response => {
        res.status(200).json({
            status: true,
            response: response
        });
    }).catch(err => {
        res.status(500).json({
            status: false,
            response: err
        });
    });
});

//Kirim Media file system
app.post('/send-media', (req, res) => {  
    const number = req.body.number;
    const caption = req.body.caption;

    const formNum = number.replace(/\D/g, '');

    if (formNum.startsWith('0')) {
        formNumber = '62'+formNum.substr(1)
    }
    
    const pars = formNumber.includes('@c.us') ? formNumber : `${formNumber}@c.us`;
    const media = MessageMedia.fromFilePath('./kaligrafi.png');
        client.sendMessage(pars, media, {caption : caption}).then(response => {
        res.status(200).json({
            status: true,
            response: response
        });
    }).catch(err => {
        res.status(500).json({
            status: false,
            response: err
        });
    });
});

// Kirim media URL
app.post('/send-mediaurl', async (req, res) => {  
    const number = req.body.number;
    const caption = req.body.caption;
    const fileUrl = req.body.file;

    const formNum = number.replace(/\D/g, '');

    if (formNum.startsWith('0')) {
        formNumber = '62'+formNum.substr(1)
    }
    
    const pars = formNumber.includes('@c.us') ? formNumber : `${formNumber}@c.us`;
    let mimetype;
    const attachment = await axios.get(fileUrl, { responseType: 'arraybuffer' }).then(response => {
        mimetype = response.headers['content-type'];
        return response.data.toString('base64');
    });
    const media = new MessageMedia(mimetype, attachment, 'Media')
    
        client.sendMessage(pars, media, {caption : caption}).then(response => {
        res.status(200).json({
            status: true,
            response: response
        });
    }).catch(err => {
        res.status(500).json({
            status: false,
            response: err
        });
    });
});

server.listen(8000, function () {
    console.log('Aplikasi Sedang Berjalan... ' + 8000);
});