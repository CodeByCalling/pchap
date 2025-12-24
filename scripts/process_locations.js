
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://raw.githubusercontent.com/isaacdarcilla/philippine-addresses/main';
const DATA_DIR = path.join(__dirname, '../public/assets/data');
const BARANGAY_DIR = path.join(DATA_DIR, 'barangays');

// Create directories if they don't exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BARANGAY_DIR)) fs.mkdirSync(BARANGAY_DIR, { recursive: true });

const fetchJson = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
};

const processData = async () => {
    try {
        console.log('Fetching Regions...');
        const regions = await fetchJson(`${BASE_URL}/region.json`);
        fs.writeFileSync(path.join(DATA_DIR, 'regions.json'), JSON.stringify(regions, null, 2));

        console.log('Fetching Provinces...');
        const provinces = await fetchJson(`${BASE_URL}/province.json`);
        fs.writeFileSync(path.join(DATA_DIR, 'provinces.json'), JSON.stringify(provinces, null, 2));

        console.log('Fetching Cities/Municipalities...');
        const cities = await fetchJson(`${BASE_URL}/city.json`);
        fs.writeFileSync(path.join(DATA_DIR, 'cities.json'), JSON.stringify(cities, null, 2));

        console.log('Fetching Barangays (this may take a while)...');
        const barangays = await fetchJson(`${BASE_URL}/barangay.json`);
        
        console.log(`Processing ${barangays.length} barangays...`);
        
        // Group barangays by city_code
        const barangaysByCity = {};
        barangays.forEach(b => {
            // The source data uses 'city_code' to link to city
            if (!barangaysByCity[b.city_code]) {
                barangaysByCity[b.city_code] = [];
            }
            barangaysByCity[b.city_code].push({
                brgy_code: b.brgy_code,
                brgy_name: b.brgy_name,
                province_code: b.province_code,
                region_code: b.region_code
            });
        });

        console.log(`Writing ${Object.keys(barangaysByCity).length} barangay chunk files...`);
        
        Object.keys(barangaysByCity).forEach(cityCode => {
            const filePath = path.join(BARANGAY_DIR, `${cityCode}.json`);
            fs.writeFileSync(filePath, JSON.stringify(barangaysByCity[cityCode]));
        });

        console.log('Data processing complete!');

    } catch (error) {
        console.error('Error processing data:', error);
    }
};

processData();
