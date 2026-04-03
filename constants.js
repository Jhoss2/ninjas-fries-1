const { Dimensions } = require('react-native');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const PRINTER_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
const PRINTER_CHAR_UUID = '00002af1-0000-1000-8000-00805f9b34fb';

const CARD_WIDTH = SCREEN_WIDTH * 0.55;
const ITEM_SIZE = CARD_WIDTH;

const DAILY_COLORS = [
  '#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e',
  '#10b981','#14b8a6','#06b6d4','#0ea5e9','#3b82f6','#6366f1',
  '#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e','#fb7185',
  '#fb923c','#fbbf24','#a3e635','#4ade80','#34d399','#2dd4bf',
  '#22d3ee','#38bdf8','#60a5fa','#818cf8','#a78bfa','#c084fc'
];

const WEBRTC_SIGNAL_PATH = 'webrtc-signals';

module.exports = {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  PRINTER_SERVICE_UUID,
  PRINTER_CHAR_UUID,
  CARD_WIDTH,
  ITEM_SIZE,
  DAILY_COLORS,
  WEBRTC_SIGNAL_PATH,
};
