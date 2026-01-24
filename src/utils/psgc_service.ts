import locations from '../assets/data/locations.json';

// Type definitions for the JSON structure
interface BarangayList {
    barangay_list: string[];
}

interface MunicipalityList {
    municipality_list: Record<string, BarangayList>;
}

interface ProvinceList {
    province_list: Record<string, MunicipalityList>;
}

interface RegionEntry {
    region_name: string;
    province_list: Record<string, any>; // Using any here because of the nested structure variance
}

const LOCATION_DATA = locations as Record<string, RegionEntry>;

export interface PsgcLocation {
    code: string;
    name: string;
}

export const PsgcService = {
    
    getRegions(): PsgcLocation[] {
        const regions = Object.keys(LOCATION_DATA).map(key => ({
            code: key,
            name: LOCATION_DATA[key].region_name
        }));

        // Custom Sorting
        // 1. Metro Manila (NCR) -> Top
        // 2. A-Z
        // 3. BARMM, CAR, NIR -> Bottom
        
        // Filter duplicates (NCR vs Metro Manila)
        // We only want ONE entry for NCR. Ideally 'Metro Manila'.
        const uniqueRegions = new Map();
        regions.forEach(r => {
            let key = r.code;
            // Normalize NCR
            if (r.name.includes('NCR') || r.name.includes('Metro Manila')) {
                key = 'NCR_METRO_MANILA'; // Canonical key
            }
            if (!uniqueRegions.has(key)) {
                uniqueRegions.set(key, r);
            }
        });
        
        const filteredRegions = Array.from(uniqueRegions.values());

        return filteredRegions.sort((a, b) => {
            const nameA = a.name.toUpperCase();
            const nameB = b.name.toUpperCase();

            // NCR Priority
            const isNcrA = nameA.includes('NCR') || nameA.includes('METRO MANILA');
            const isNcrB = nameB.includes('NCR') || nameB.includes('METRO MANILA');
            if (isNcrA) return -1;
            if (isNcrB) return 1;

            // Bottom Priority Groups
            const bottomKeywords = ['BARMM', 'BANGSAMORO', 'CORDILLERA', 'CAR', 'NEGROS ISLAND', 'NIR'];
            // Check if A/B belong to bottom group
            const isBottomA = bottomKeywords.some(k => nameA.includes(k));
            const isBottomB = bottomKeywords.some(k => nameB.includes(k));

            if (isBottomA && !isBottomB) return 1;
            if (!isBottomA && isBottomB) return -1;

            // Standard Sort
            return nameA.localeCompare(nameB);
        });
    },

    getProvinces(regionCode: string): PsgcLocation[] {
        const region = LOCATION_DATA[regionCode];
        if (!region) return [];

        // NCR Logic: Return logic "Metro Manila"
        if (region.region_name.includes('NCR') || region.region_name.includes('METRO MANILA')) {
            return [{
                code: 'NCR_METRO_MANILA', // Virtual Code
                name: 'Metro Manila'
            }];
        }

        // Standard Logic
        return Object.keys(region.province_list).map(key => ({
            code: key, // Using Name as Code for Provinces
            name: key
        })).sort((a, b) => a.name.localeCompare(b.name));
    },

    // Updated Signature: Needs Region Code because Provinces are nested under Regions
    getCities(provinceCode: string, regionCode: string): PsgcLocation[] {
        const region = LOCATION_DATA[regionCode];
        if (!region) return [];

        let cities: string[] = [];

        // NCR Logic: Aggregate from all "Districts"
        if (provinceCode === 'NCR_METRO_MANILA' || region.region_name.includes('NCR')) {
             const districts = region.province_list;
             Object.keys(districts).forEach(distKey => {
                 const district = districts[distKey];
                 if (district.municipality_list) {
                     cities.push(...Object.keys(district.municipality_list));
                 }
             });
        } else {
            // Standard Logic
            const province = region.province_list[provinceCode];
            if (province && province.municipality_list) {
                cities = Object.keys(province.municipality_list);
            }
        }

        return cities.map(name => ({
            code: name, // Using Name as Code
            name: name
        })).sort((a, b) => a.name.localeCompare(b.name));
    },

    // Updated Signature: Needs full hierarchy to find the city in the tree
    getBarangays(cityCode: string, provinceCode: string, regionCode: string): PsgcLocation[] {
        const region = LOCATION_DATA[regionCode];
        if (!region) return [];

        let barangays: string[] = [];

        if (provinceCode === 'NCR_METRO_MANILA' || region.region_name.includes('NCR')) {
            // Search for the city across all NCR districts
            const districts = region.province_list;
            for (const distKey of Object.keys(districts)) {
                const municipalityList = districts[distKey].municipality_list;
                if (municipalityList && municipalityList[cityCode]) {
                    barangays = municipalityList[cityCode].barangay_list;
                    break;
                }
            }
        } else {
             // Standard
             const province = region.province_list[provinceCode];
             if (province && province.municipality_list && province.municipality_list[cityCode]) {
                 barangays = province.municipality_list[cityCode].barangay_list;
             }
        }

        return barangays.map(name => ({
            code: name,
            name: name
        })).sort((a, b) => a.name.localeCompare(b.name));
    },

    suggestZipCode(cityName: string): string | null {
        // ZIP Code logic remains strictly heuristic/mapped as JSON doesn't contain ZIPs
        const ZIP_CODE_MAP: Record<string, string> = {
            'MANILA': '1000',
            'QUEZON CITY': '1100', 
            'MAKATI': '1200',
            'TAGUIG': '1630',
            'PASIG': '1600',
            'MANDALUYONG': '1550',
            'PASAY': '1300',
            'CALOOCAN': '1400',
            'LAS PIÑAS': '1740',
            'MUNTINLUPA': '1770',
            'MARIKINA': '1800',
            'VALENZUELA': '1440',
            'PARAÑAQUE': '1700',
            'MALABON': '1470',
            'NAVOTAS': '1485',
            'SAN JUAN': '1500',
            'PATEROS': '1620'
        };

        const upperCity = cityName.toUpperCase();
        for (const [key, zip] of Object.entries(ZIP_CODE_MAP)) {
            if (upperCity.includes(key)) return zip;
        }
        return null;
    }
};
