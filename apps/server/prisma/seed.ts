/**
 * Freizy Stays pilot seed — 10 hostels around Legon (+2 out-of-town for filter demo).
 * Run after `npm run db:push`:  npm run db:seed
 * Safe to re-run (upserts by fixed id).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const pics = (seed: string) => Array.from({ length: 5 }, (_, i) => `https://picsum.photos/seed/freizy-${seed}-${i}/800/600`);

interface SeedHostel {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  distanceToCampusKm: number;
  pricePerSemester: number;
  amenities: string[];
  isVerified: boolean;
  lightScore: number;
  waterScore: number;
  agentFee: boolean;
  momoAllowed: boolean;
  school: string;
}

const HOSTELS: SeedHostel[] = [
  { id: "seed-h1", name: "East Legon Heights", location: "East Legon, Accra", latitude: 5.644, longitude: -0.161, distanceToCampusKm: 0.8, pricePerSemester: 3500, amenities: ["WiFi", "Water 24/7", "Self-contained", "Close to campus"], isVerified: true, lightScore: 4.5, waterScore: 4.8, agentFee: false, momoAllowed: true, school: "Legon" },
  { id: "seed-h2", name: "Madina Lodge", location: "Madina, Accra", latitude: 5.683, longitude: -0.166, distanceToCampusKm: 1.5, pricePerSemester: 2200, amenities: ["WiFi", "Water 24/7"], isVerified: true, lightScore: 4.2, waterScore: 4.6, agentFee: false, momoAllowed: true, school: "Legon" },
  { id: "seed-h3", name: "Adenta Student House", location: "Adenta, Accra", latitude: 5.707, longitude: -0.161, distanceToCampusKm: 2.4, pricePerSemester: 1800, amenities: ["Water 24/7"], isVerified: false, lightScore: 3.8, waterScore: 4.0, agentFee: true, momoAllowed: true, school: "Legon" },
  { id: "seed-h4", name: "Haatso Premium Residence", location: "Haatso, Accra", latitude: 5.667, longitude: -0.193, distanceToCampusKm: 1.1, pricePerSemester: 4800, amenities: ["WiFi", "Water 24/7", "Single room", "Self-contained", "Close to campus"], isVerified: true, lightScore: 4.9, waterScore: 4.9, agentFee: false, momoAllowed: true, school: "Legon" },
  { id: "seed-h5", name: "Atomic Junction Flats", location: "Atomic, Accra", latitude: 5.652, longitude: -0.183, distanceToCampusKm: 0.6, pricePerSemester: 2900, amenities: ["WiFi", "Water 24/7", "Close to campus"], isVerified: false, lightScore: 4.1, waterScore: 4.3, agentFee: false, momoAllowed: true, school: "Legon" },
  { id: "seed-h6", name: "Pantang Village Hostel", location: "Pantang, Accra", latitude: 5.715, longitude: -0.145, distanceToCampusKm: 3.2, pricePerSemester: 1500, amenities: ["Water 24/7"], isVerified: false, lightScore: 3.5, waterScore: 3.9, agentFee: false, momoAllowed: false, school: "Legon" },
  { id: "seed-h7", name: "Westlands Study Suites", location: "Westlands, Accra", latitude: 5.608, longitude: -0.209, distanceToCampusKm: 4.5, pricePerSemester: 6500, amenities: ["WiFi", "Water 24/7", "Single room", "Self-contained"], isVerified: true, lightScore: 4.8, waterScore: 4.7, agentFee: false, momoAllowed: true, school: "Legon" },
  { id: "seed-h8", name: "UPSA Road Apartments", location: "Madina, Accra", latitude: 5.676, longitude: -0.173, distanceToCampusKm: 1.9, pricePerSemester: 3200, amenities: ["WiFi", "Water 24/7", "Single room"], isVerified: false, lightScore: 4.3, waterScore: 4.4, agentFee: true, momoAllowed: true, school: "UPSA" },
  { id: "seed-h9", name: "Ayensu Riverside Lodge", location: "Ayensu, Kumasi", latitude: 6.674, longitude: -1.574, distanceToCampusKm: 1.2, pricePerSemester: 2800, amenities: ["WiFi", "Water 24/7", "Close to campus"], isVerified: true, lightScore: 4.0, waterScore: 4.2, agentFee: false, momoAllowed: true, school: "KNUST" },
  { id: "seed-h10", name: "Cape Varsity Court", location: "Cape Coast", latitude: 5.108, longitude: -1.281, distanceToCampusKm: 0.9, pricePerSemester: 2500, amenities: ["WiFi", "Water 24/7"], isVerified: false, lightScore: 4.1, waterScore: 4.5, agentFee: false, momoAllowed: true, school: "UCC" },
];

async function main() {
  const owner = await prisma.user.upsert({
    where: { phone: "+233200000001" },
    update: {},
    create: { phone: "+233200000001", role: "OWNER", school: "Legon" },
  });
  console.log(`owner: ${owner.id}`);

  for (const h of HOSTELS) {
    const { id, ...rest } = h;
    await prisma.hostel.upsert({
      where: { id },
      update: { ...rest, ownerId: owner.id },
      create: { id, ...rest, ownerId: owner.id, images: pics(id), videoUrl: null },
    });
  }
  console.log(`seeded ${HOSTELS.length} hostels`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
