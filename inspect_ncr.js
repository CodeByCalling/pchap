
const { getRegions } = require('latest-ph-address-thanks-to-anehan');
const regions = getRegions();
const ncr = regions.find(r => r.name.includes('NCR') || r.name.includes('Metro Manila'));
console.log('NCR Data:', ncr);
