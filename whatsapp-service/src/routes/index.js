const { Router } = require('express');
const messageController = require('../controllers/message.controller');
const { requireApiKey } = require('../middleware/apiKey');

const router = Router();

// Salud del proceso: sin clave, para que Docker pueda comprobarlo.
router.get('/health', (req, res) => {
  res.status(200).json({ estado: 'ok', servicio: 'whatsapp-service' });
});

router.get('/status', requireApiKey, messageController.getStatus);
router.get('/qr', requireApiKey, messageController.getQr);
router.post('/send-message', requireApiKey, messageController.sendMessage);

// Desvincular la cuenta: cierra la sesión y deja el servicio pidiendo un QR.
router.post('/logout', requireApiKey, messageController.logout);

module.exports = router;
