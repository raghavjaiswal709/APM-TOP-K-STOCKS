const fs = require('fs');
const path = require('path');
const RECORDED_DATA_PATH = path.join(__dirname, '..', 'public', 'recorded_data');
const MANIFEST_PATH = path.join(__dirname, '..', 'public', 'data-manifest.json');
function generateManifest() {
  try {
    const manifest = {
      dates: [],
      lastUpdated: new Date().toISOString()
    };
    if (!fs.existsSync(RECORDED_DATA_PATH)) {
      console.log('❌ recorded_data directory not found');
      return;
    }
    const dateDirectories = fs.readdirSync(RECORDED_DATA_PATH, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .filter(name => /^\d{4}-\d{2}-\d{2}$/.test(name))
      .sort((a, b) => b.localeCompare(a));
    for (const dateDir of dateDirectories) {
      const datePath = path.join(RECORDED_DATA_PATH, dateDir);
      const jsonFiles = fs.readdirSync(datePath)
        .filter(file => file.endsWith('.json'))
        .map(file => {
          const fileNameWithoutExt = file.replace('.json', '');
          const [company, exchange] = fileNameWithoutExt.split('-');
          return {
            symbol: `${exchange}:${company}-EQ`,
            company: company,
            exchange: exchange,
            fileName: file,
            fileNameWithoutExt: fileNameWithoutExt
          };
        });
      if (jsonFiles.length > 0) {
        manifest.dates.push({
          date: dateDir,
          displayDate: dateDir,
          companiesCount: jsonFiles.length,
          companies: jsonFiles
        });
      }
    }
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    console.log(`✅ Generated manifest with ${manifest.dates.length} dates`);
    console.log(`📁 Total companies across all dates: ${manifest.dates.reduce((sum, d) => sum + d.companiesCount, 0)}`);
  } catch (error) {
    console.error('❌ Error generating manifest:', error);
    process.exit(1);
  }
}
generateManifest();

