export interface Region {
    id: number;
    psgc_code: string;
    region_name: string;
    region_code: string;
}

export interface Province {
    province_code: string;
    province_name: string;
    psgc_code: string;
    region_code: string;
}

export interface City {
    city_code: string;
    city_name: string;
    province_code: string;
    psgc_code: string;
    region_desc: string;
}

export interface Barangay {
    brgy_code: string;
    brgy_name: string;
    province_code: string; 
    region_code: string;
}

// Cache to prevent redundant network requests
const CACHE: {
    regions: Region[] | null;
    provinces: Province[] | null;
    cities: City[] | null;
    barangays: Record<string, Barangay[]>
} = {
    regions: null,
    provinces: null,
    cities: null,
    barangays: {}
};

export const AddressService = {
    async getRegions(): Promise<Region[]> {
        if (CACHE.regions) return CACHE.regions;
        try {
            const res = await fetch('/assets/data/regions.json');
            if (!res.ok) throw new Error('Failed to fetch regions');
            const data = await res.json();
            // Sort by region code or name as needed; source data is roughly ordered
            CACHE.regions = data;
            return data;
        } catch (e) {
            console.error(e);
            return [];
        }
    },

    async getProvinces(regionCode: string): Promise<Province[]> {
        if (!CACHE.provinces) {
            try {
                const res = await fetch('/assets/data/provinces.json');
                if (!res.ok) throw new Error('Failed to fetch provinces');
                CACHE.provinces = await res.json();
            } catch (e) {
                console.error(e);
                return [];
            }
        }
        return CACHE.provinces!.filter(p => p.region_code === regionCode);
    },

    async getCities(provinceCode: string): Promise<City[]> {
        if (!CACHE.cities) {
            try {
                const res = await fetch('/assets/data/cities.json');
                if (!res.ok) throw new Error('Failed to fetch cities');
                CACHE.cities = await res.json();
            } catch (e) {
                console.error(e);
                return [];
            }
        }
        // Some cities (like in NCR) might map differently if they don't have a province code in the same way,
        // but typically standard PSGC maps them.
        // NOTE: For NCR, province_code might be equivalent to a district or specific code.
        // Let's filter strictly.
        return CACHE.cities!.filter(c => c.province_code === provinceCode);
    },

    async getBarangays(cityCode: string): Promise<Barangay[]> {
        if (CACHE.barangays[cityCode]) return CACHE.barangays[cityCode];
        try {
            // Lazy load - crucial performance requirement
            const res = await fetch(`/assets/data/barangays/${cityCode}.json`);
            if (!res.ok) throw new Error(`Failed to fetch barangays for city ${cityCode}`);
            const data = await res.json();
            CACHE.barangays[cityCode] = data;
            return data;
        } catch (e) {
            console.warn(`No barangays found/loaded for city ${cityCode}`, e);
            return [];
        }
    }
};
