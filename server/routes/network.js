// server/routes/network.js
const express = require('express');
const router = express.Router();
const os = require('os');

function getAllIPs() {
    const interfaces = os.networkInterfaces();
    const ips = new Set(['localhost']);

    for (const [name, netInterface] of Object.entries(interfaces)) {
        if (name.includes('lo') || name.toLowerCase().includes('virtual') || name.toLowerCase().includes('vmnet')) continue;
        for (const addr of netInterface) {
            if (addr.family === 'IPv4' && !addr.internal) {
                ips.add(addr.address);
            }
        }
    }
    return Array.from(ips);
}

router.get('/ip', (req, res) => {
    res.json({ ips: getAllIPs() });
});

module.exports = router;
