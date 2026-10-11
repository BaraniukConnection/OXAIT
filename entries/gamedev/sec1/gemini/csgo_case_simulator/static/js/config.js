/**
 * CS:GO Shared Configuration: Weapons, Skins, and Cases Catalogue
 * Available to all client modules and fallback simulator
 */

const WEAPONS = {
    "M4A1": { category: "Assault", label: "M4A1-S", multiplier: 1.25 },
    "Ak47": { category: "Assault", label: "AK-47", multiplier: 1.35 },
    "Desert Eagle": { category: "Pistol", label: "Desert Eagle", multiplier: 1.15 },
    "Glock": { category: "Pistol", label: "Glock-18", multiplier: 1.0 },
    "MP5": { category: "SMG", label: "MP5-SD", multiplier: 1.05 },
    "P90": { category: "SMG", label: "P90", multiplier: 1.0 },
    "BenelliM4": { category: "Shotgun", label: "Benelli M4", multiplier: 0.95 },
    "Nova": { category: "Shotgun", label: "Nova", multiplier: 0.90 },
    "M249": { category: "LMG", label: "M249", multiplier: 0.90 },
    "Negev": { category: "LMG", label: "Negev", multiplier: 0.95 },
};

const SKIN_TEMPLATES = [
    {
        id_suffix: "p1_v1",
        pattern: "Digital Grid",
        name: "Urban Ghost",
        variant: "Urban Silver / Carbon",
        geom_design: "Hexagonal Grid",
        rarity: "Common",
        base_price: 9.50,
        primary_color: "#2a313d",
        secondary_color: "#8b9bb4",
        accent_color: "#4da6ff",
    },
    {
        id_suffix: "p1_v2",
        pattern: "Digital Grid",
        name: "Tundra Splinter",
        variant: "Forest Moss / Slate",
        geom_design: "Splinter Triangle Shards",
        rarity: "Common",
        base_price: 12.00,
        primary_color: "#28382c",
        secondary_color: "#5b755d",
        accent_color: "#94b88d",
    },
    {
        id_suffix: "p2_v1",
        pattern: "Cyber Net",
        name: "Neon Pulse",
        variant: "Cyber Cyan / Magenta",
        geom_design: "Vector Circuit Traces",
        rarity: "Rare",
        base_price: 48.00,
        primary_color: "#0d1b2a",
        secondary_color: "#00f0ff",
        accent_color: "#ff007f",
    },
    {
        id_suffix: "p2_v2",
        pattern: "Cyber Net",
        name: "Acid Matrix",
        variant: "Toxic Lime / Onyx",
        geom_design: "Chevron Data Glitch",
        rarity: "Rare",
        base_price: 62.00,
        primary_color: "#121914",
        secondary_color: "#39ff14",
        accent_color: "#a1ff0a",
    },
    {
        id_suffix: "p3_v1",
        pattern: "Dragon Inferno",
        name: "Solar Flare",
        variant: "Molten Crimson / Ember",
        geom_design: "Dragon Scale Waves",
        rarity: "Epic",
        base_price: 240.00,
        primary_color: "#400808",
        secondary_color: "#ff3b00",
        accent_color: "#ffae00",
    },
    {
        id_suffix: "p4_v1",
        pattern: "Poly-Tech",
        name: "Hyper Hazard",
        variant: "Hazard Orange / Ceramic White",
        geom_design: "Asymmetric Poly Angles",
        rarity: "Legendary",
        base_price: 1450.00,
        primary_color: "#ededed",
        secondary_color: "#ff6600",
        accent_color: "#1a1a1a",
    },
    {
        id_suffix: "p5_v2",
        pattern: "Royal Damascus",
        name: "Imperial Obsidian",
        variant: "Void Gold / Damascus Onyx",
        geom_design: "Guilloche Damask Lattice",
        rarity: "Legendary",
        base_price: 1950.00,
        primary_color: "#0e1017",
        secondary_color: "#ffd700",
        accent_color: "#b8860b",
    },
];

// Generate all 70 skins
const ALL_SKINS = {};
for (const [w_id, w_info] of Object.entries(WEAPONS)) {
    for (const tmpl of SKIN_TEMPLATES) {
        const skin_id = `${w_id}_${tmpl.id_suffix}`;
        const full_name = `${w_info.label} | ${tmpl.name}`;
        const base_val = Math.round(tmpl.base_price * w_info.multiplier * 100) / 100;
        ALL_SKINS[skin_id] = {
            id: skin_id,
            weapon: w_id,
            weapon_label: w_info.label,
            category: w_info.category,
            pattern: tmpl.pattern,
            name: tmpl.name,
            full_name: full_name,
            variant: tmpl.variant,
            geom_design: tmpl.geom_design,
            rarity: tmpl.rarity,
            base_price: base_val,
            primary_color: tmpl.primary_color,
            secondary_color: tmpl.secondary_color,
            accent_color: tmpl.accent_color,
        };
    }
}

const CASES_CATALOG = {
    "assault_case": {
        id: "assault_case",
        name: "Assault Case",
        price: 170,
        category: "Assault",
        weapons: ["M4A1", "Ak47"],
        icon_color: "#e056fd",
        description: "Contains specialized skins for M4A1 and AK-47 rifles.",
        odds: { Common: 0.79, Rare: 0.16, Epic: 0.04, Legendary: 0.01 },
    },
    "pistol_case": {
        id: "pistol_case",
        name: "Pistol Case",
        price: 100,
        category: "Pistol",
        weapons: ["Desert Eagle", "Glock"],
        icon_color: "#686de0",
        description: "Sidearm firepower skins for Desert Eagle and Glock.",
        odds: { Common: 0.79, Rare: 0.16, Epic: 0.04, Legendary: 0.01 },
    },
    "smg_case": {
        id: "smg_case",
        name: "SMG Case",
        price: 130,
        category: "SMG",
        weapons: ["MP5", "P90"],
        icon_color: "#30336b",
        description: "High cyclic rate submachine gun finishes for MP5 and P90.",
        odds: { Common: 0.79, Rare: 0.16, Epic: 0.04, Legendary: 0.01 },
    },
    "shotgun_case": {
        id: "shotgun_case",
        name: "Shotgun Case",
        price: 150,
        category: "Shotgun",
        weapons: ["BenelliM4", "Nova"],
        icon_color: "#eb4d4b",
        description: "Heavy gauge buckshot skins for Benelli M4 and Nova.",
        odds: { Common: 0.79, Rare: 0.16, Epic: 0.04, Legendary: 0.01 },
    },
    "lmg_case": {
        id: "lmg_case",
        name: "LMG Case",
        price: 160,
        category: "LMG",
        weapons: ["M249", "Negev"],
        icon_color: "#f0932b",
        description: "Heavy suppressing fire skins for M249 and Negev.",
        odds: { Common: 0.79, Rare: 0.16, Epic: 0.04, Legendary: 0.01 },
    },
    "legendary_case": {
        id: "legendary_case",
        name: "Legendary Case",
        price: 2500,
        category: "All",
        weapons: Object.keys(WEAPONS),
        icon_color: "#f1c40f",
        description: "Ultra exclusive crate dropping ONLY Legendary tier skins across all weapons!",
        odds: { Legendary: 1.0 },
    },
};

window.CSGO_CONFIG = {
    WEAPONS,
    SKIN_TEMPLATES,
    ALL_SKINS,
    CASES_CATALOG,
};
