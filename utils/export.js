const FileSystem = require('expo-file-system');
const Sharing = require('expo-sharing');
const { Alert } = require('react-native');

const exportOrdersToCSV = async (orderHistory) => {
  let csv = 'Date;Heure;Articles;Détails Extras;Total\n';
  orderHistory.forEach(o => {
    const itemsList = JSON.parse(o.items || '[]');
    const itemsNames = itemsList.map(i => `${i.quantity}x ${i.name.toUpperCase()}`).join(' | ');

    const extrasDetails = itemsList.map(i => {
      const extras = JSON.parse(i.extras || '{}');
      const sauces = (extras.sauces || []).map(s => `${s.name.toUpperCase()} (0F)`).join(', ');
      const garnitures = (extras.garnitures || []).map(g => `${g.name.toUpperCase()} (${g.price}F)`).join(', ');
      return `[${i.name.toUpperCase()}: Sauces: ${sauces || 'Aucune'} | Garnitures: ${garnitures || 'Aucune'}]`;
    }).join(' ; ');

    csv += `${o.date};${o.time};${itemsNames};${extrasDetails};${o.total}\n`;
  });

  const fileUri = FileSystem.documentDirectory + `historique_${Date.now()}.csv`;
  try {
    await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(fileUri);
  } catch (error) {
    console.error("Erreur export CSV:", error);
    Alert.alert("Erreur", "Impossible d'exporter l'historique.");
  }
};

module.exports = { exportOrdersToCSV };
