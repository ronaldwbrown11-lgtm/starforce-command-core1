import type { StarData } from "./galaxyData";

// HYG v3 by David Nash, CC BY-SA 2.5: https://www.astronexus.com/projects/hyg
// Snapshot: https://github.com/kiloquad/__HYG-Database/blob/master/hygdata_v3.csv
// [HYG id, name, J2000 RA hours, Dec degrees, distance pc, V magnitude, B-V].
const catalog: [string, string, number, number, number, number, number][] = [
  ["32263","Sirius",6.752481,-16.716116,2.6371,-1.44,0.009],
  ["30365","Canopus",6.399195,-52.69566,94.7867,-0.62,0.164],
  ["69451","Arcturus",14.26103,19.18241,11.2575,-0.05,1.239],
  ["71456","Rigil Kentaurus",14.660765,-60.833976,1.3248,-0.01,0.71],
  ["90979","Vega",18.61564,38.783692,7.6787,0.03,-0.001],
  ["24549","Capella",5.27815,45.997991,13.1234,0.08,0.795],
  ["24378","Rigel",5.242298,-8.20164,264.5503,0.18,-0.03],
  ["37173","Procyon",7.655033,5.224993,3.5142,0.4,0.432],
  ["7574","Achernar",1.628556,-57.236757,42.7533,0.45,-0.158],
  ["27919","Betelgeuse",5.919529,7.407063,152.6718,0.45,1.5],
  ["68483","Hadar",14.063729,-60.373039,120.1923,0.61,-0.231],
  ["97338","Altair",19.846388,8.868322,5.1295,0.76,0.221],
  ["60530","Acrux",12.443311,-63.099092,98.7167,0.77,-0.243],
  ["21368","Aldebaran",4.598677,16.509301,20.4332,0.87,1.538],
  ["65269","Spica",13.419883,-11.161322,76.5697,0.98,-0.235],
  ["80519","Antares",16.490128,-26.432002,169.7793,1.06,1.865],
  ["37718","Pollux",7.755277,28.026199,10.3584,1.16,0.991],
  ["113008","Fomalhaut",22.960838,-29.622236,7.7036,1.17,0.145],
  ["62239","Becrux",12.795359,-59.688764,85.3971,1.25,-0.238],
  ["101767","Deneb",20.690532,45.280338,432.9004,1.25,0.092],
  ["49528","Regulus",10.139532,11.967207,24.3132,1.36,-0.087],
  ["33492","Adhara",6.977097,-28.972084,124.2236,1.5,-0.211],
  ["36744","Castor",7.576634,31.888276,15.5958,1.58,0.034],
  ["60893","Gacrux",12.519429,-57.113212,27.1518,1.59,1.6],
  ["85665","Shaula",17.560145,-37.103821,175.1313,1.62,-0.231],
  ["25273","Bellatrix",5.418851,6.349702,77.3994,1.64,-0.224],
  ["25364","Alnath",5.438198,28.60745,41.0509,1.65,-0.13],
  ["45106","Miaplacidus",9.220041,-69.717208,34.6981,1.67,0.07],
  ["26246","Alnilam",5.603559,-1.20192,606.0606,1.69,-0.184],
  ["108922","Alnair",22.137209,-46.960975,30.9693,1.73,-0.07],
  ["26662","Alnitak",5.679313,-1.942572,225.7336,1.74,-0.199],
  ["62757","Alioth",12.900472,55.959821,25.31,1.76,-0.022],
  ["15824","Mirphak",3.405378,49.86118,155.2795,1.79,0.481],
  ["89906","Kaus Australis",18.402868,-34.384616,43.9367,1.79,-0.031],
  ["53905","Dubhe",11.062155,61.751033,37.679,1.81,1.061],
  ["34354","Wezen",7.139857,-26.3932,492.6108,1.83,0.671],
  ["67088","Alkaid",13.792354,49.313265,31.8674,1.85,-0.099],
  ["40921","Avior",8.375236,-59.509483,185.5288,1.86,1.196],
  ["85965","Sargas",17.62198,-42.997824,92.081,1.86,0.406],
  ["28288","Menkalinan",5.992149,44.947433,24.8694,1.9,0.077],
  ["82022","Atria",16.811077,-69.027715,119.7605,1.91,1.447],
  ["31601","Alhena",6.628528,16.399252,33.5121,1.93,0.001],
  ["100425","Peacock",20.427459,-56.73509,54.8246,1.94,-0.118],
  ["11734","Polaris",2.52975,89.264109,132.626,1.97,0.636],
  ["30251","Mirzam",6.378329,-17.955918,151.0574,1.98,-0.24],
  ["46259","Alphard",9.45979,-8.658603,55.2792,1.99,1.44],
  ["9861","Hamal",2.119555,23.462423,20.1776,2.01,1.151],
  ["50440","Algieba",10.332873,19.841489,39.8883,2.01,1.128],
  ["3413","Diphda",0.72649,-17.986605,29.5334,2.04,1.019],
  ["92564","Nunki",18.92109,-26.296722,69.8324,2.05,-0.134],
  ["68714","Menkent",14.111395,-36.369954,18.0343,2.06,1.011],
  ["676","Alpheratz",0.139791,29.090432,29.7442,2.07,-0.038],
  ["5436","Mirach",1.162194,35.620558,60.5327,2.07,1.576],
  ["27298","Saiph",5.795941,-9.669605,198.4127,2.07,-0.168],
  ["72380","Kochab",14.845105,74.155505,40.1445,2.07,1.465],
  ["85769","Rasalhague",17.582241,12.560035,14.8965,2.08,0.155],
  ["14540","Algol",3.136148,40.955648,27.571,2.09,-0.003],
  ["9618","Almaak",2.064984,42.329725,120.4819,2.1,1.37],
  ["57459","Denebola",11.817663,14.57206,10.9999,2.14,0.09],
  ["4417","Cih",0.945143,60.71674,168.3502,2.15,-0.046],
  ["53565","47 Ursa Majoris",10.99112,40.430257,14.0627,5.03,0.624],
];

export const PARSECS_PER_UNIT = 620;
// Equatorial J2000 -> IAU Galactic rotation matrix. Map +X outward from GC,
// +Y north of the Galactic plane; orient Sol at the existing Orion Spur marker.
export function equatorialToGalaxy(ra: number, dec: number, pc: number): [number, number, number] {
  const a = ra * Math.PI / 12;
  const d = dec * Math.PI / 180;
  const x = pc * Math.cos(d) * Math.cos(a);
  const y = pc * Math.cos(d) * Math.sin(a);
  const z = pc * Math.sin(d);
  const gx = -0.0548755604*x - 0.8734370902*y - 0.4838350155*z;
  const gy = 0.4941094279*x - 0.44482963*y + 0.7469822445*z;
  const gz = -0.867666149*x - 0.1980763734*y + 0.4559837762*z;
  const angle = Math.atan2(-5.2, 11.8);
  const outward = -gx / PARSECS_PER_UNIT;
  const tangent = gy / PARSECS_PER_UNIT;
  return [11.8 + outward*Math.cos(angle) - tangent*Math.sin(angle), 0.04 + gz/PARSECS_PER_UNIT, -5.2 + outward*Math.sin(angle) + tangent*Math.cos(angle)];
}

// Ultra Force lore: 47 Ursa Majoris is the capital of the Orion Triangle, so
// it renders with a capital marker ring and an enlarged radius.
const CAPITAL_STARS: Record<string, string> = {
  "hyg-53565": "Capital of the Orion Triangle",
};

export const REAL_STARS: StarData[] = catalog.map(([id, name, ra, dec, pc, magnitude, ci]) => {
  const temperature = 4600 * (1/(0.92*ci+1.7) + 1/(0.92*ci+0.62));
  const starId = `hyg-${id}`;
  const designation = CAPITAL_STARS[starId];
  return {
    id: starId, name, defaultName: name,
    position: equatorialToGalaxy(ra, dec, pc),
    color: temperature > 9000 ? "#a9c9ff" : temperature > 6500 ? "#fff0d8" : temperature > 4800 ? "#ffd36b" : "#ff8038",
    size: 1, temperature, magnitude, distancePc: pc, source: "HYG v3 · J2000", isReal: true,
    ...(designation ? { capital: true, designation } : {}),
  };
});
REAL_STARS.unshift({ id: "hyg-sol", name: "Sol", defaultName: "Sol", position: [11.8,0.04,-5.2], color: "#ffd36b", size: 1, temperature: 5772, magnitude: -26.74, distancePc: 0, source: "Solar reference origin", isReal: true });
