
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('src/assets/data/locations.json', 'utf8'));

// Find NCR (usually 13 or similar)
let ncrKey = Object.keys(data).find(key => data[key].region_name.includes('NCR') || data[key].region_name.includes('METRO MANILA'));

if (ncrKey) {
    console.log('NCR Key:', ncrKey);
    console.log('NCR Name:', data[ncrKey].region_name);
    console.log('NCR Province List Keys:', Object.keys(data[ncrKey].province_list));
    // Check first province/district details
    const firstProv = Object.keys(data[ncrKey].province_list)[0];
    if (firstProv) {
         console.log('First Province/District:', firstProv);
         console.log('Municipalities in First Prov:', Object.keys(data[ncrKey].province_list[firstProv].municipality_list));
    }
} else {
    console.log('NCR NOT FOUND under standard names');
    // Print all region names to find it
    Object.keys(data).forEach(k => console.log(`${k}: ${data[k].region_name}`));
}
