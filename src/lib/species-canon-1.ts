// =========================================================================
// Delegate Species of the Orion Triangle — canon charter, part 1 (1–50).
//
// Species Codex — Sections I–III (Species 1–50).
//
// Verbatim transcription of the "Delegate Species of the Orion Triangle"
// charter document as supplied 2026-10-14. Each entry preserves the
// species' homeworld, environment, primary ability, physiology, adaptation,
// field role / migration and suitability notes, and cultural notes in the
// charter's own wording.
//
// Numbers 31–35 were absent from the source document (see Section III).
// Species 51+ and the 91–150 range were retired by operator request and
// will be replaced in a later charter revision — see species-canon-2.ts.
// =========================================================================

import type { FactionSeed } from "./factions";

export const SPECIES_FACTIONS_1: FactionSeed[] = [
  // ---- Section I — Species 1–15 ------------------------------------------
  {
    name: "Velkarian",
    slug: "velkarian",
    category: "species",
    description: `Homeworld: Velkar Reach — Mineral forests and cavern networks with unstable terrain. Primary Ability: Biological shapeshifting (hard sci-fi tissue restructuring).

Physiology Summary. Velkarians possess a morphogenic cellular matrix composed of adaptive stem clusters, elastic collagen webs, and neural-responsive cytoskeletal proteins. Their cells reorganize under conscious control, enabling changes in limb length, dermal texture, facial structure, and body density. Rapid protein synthesis pathways and high-efficiency ATP cycling prevent tissue necrosis during restructuring. Their nervous system includes proprioceptive feedback loops that maintain balance and coordination even as their form changes. Organs shift position within flexible membranes, allowing structural reconfiguration without compromising internal stability.

Environmental Adaptation. Shapeshifting evolved as a survival mechanism in cavern ecosystems where predators hunted by silhouette and movement pattern. Velkarians adapted by altering their form to navigate tight spaces, mimic mineral formations, flatten against cavern walls, or slip through fissures. Their ability to compact or elongate their bodies allowed them to survive collapses and evade detection in crystalline forests. Over generations, this adaptation became refined into a conscious, precise biological capability.

Migration Pattern. Velkarians spread widely due to their usefulness in exploration, infiltration, and hazardous terrain navigation. Their physiology allows them to adapt to local environmental demands, making them highly valued in frontier colonies and multispecies settlements. They integrate easily into diverse societies due to their ability to adjust their form to local norms and environmental constraints.

Star Force Suitability. Elite infiltration units, reconnaissance teams, undercover operations, adaptive survival specialists. Their shapeshifting gives them unmatched versatility in stealth and terrain-specific missions, especially in environments where rigid physiology is a liability.

Cultural Notes. Velkarian culture values fluid identity, personal reinvention, and adaptability. Social rituals often involve controlled morph displays symbolizing trust, emotional openness, or artistic expression. Their art is kinetic, involving shifting forms rather than static sculpture, and their architecture often incorporates surfaces designed to interact with morph displays.`,
    accent: "#C084FC",
    icon: "sparkles",
    order: 1,
  },
  {
    name: "Helioxian",
    slug: "helioxian",
    category: "species",
    description: `Homeworld: Heliox — Plasma-active volcanic world with extreme thermal flux. Primary Ability: Living flame state (plasma vent biology).

Physiology Summary. Helioxians look human. However, they possess skin, hair, nails, and eye colors that span the range of flames. These organs channel ionized gases through dermal micro-ducts, producing a controlled "flame state" where expelled plasma forms a fiery aura. Their skin is reinforced with ceramic-protein composites capable of withstanding temperatures exceeding 2,000°C. Internal organs are shielded by silica-carbon membranes that prevent thermal damage during plasma discharge. Their metabolism includes heat-conversion pathways that transform thermal energy into biochemical fuel, allowing them to become stronger and more alert in high-heat environments.

Environmental Adaptation. Helioxians evolved in volcanic regions where plasma geysers and thermal storms were constant. Their flame state originally served as a defensive mechanism and a thermal regulator during sudden heat spikes. Plasma venting also allowed them to clear toxic gas pockets and deter predators. Over time, the flame state became a cultural symbol of resilience and transformation.

Migration Pattern. Helioxians are common in reactor maintenance, plasma engineering, and hazardous industrial zones. Their physiology makes them ideal for environments requiring extreme heat tolerance. They are frequently employed in frontier colonies where thermal hazards are frequent and conventional species cannot operate safely.

Star Force Suitability. Hazard ops, fire-suppression units, plasma-environment specialists, breaching teams. Their flame state can be used for intimidation, distraction, or controlled thermal cutting, making them valuable in both combat and engineering contexts.

Cultural Notes. Helioxian culture centers on transformation and endurance. Ritual flame dances symbolize resilience, emotional catharsis, and communal unity. Their architecture incorporates heat-shaped stone and plasma-etched metal, creating structures that glow faintly with residual thermal energy. Helioxian art often involves controlled plasma emissions used to sculpt or illuminate their surroundings.`,
    accent: "#EF4444",
    icon: "flame",
    order: 2,
  },
  {
    name: "Kethari",
    slug: "kethari",
    category: "species",
    description: `Homeworld: Kethar — Predator-dense forest world with extreme sensory competition. Primary Ability: Heightened multisensory perception.

Physiology Summary. Kethari is a felinoid/humanoid hybrid that possesses multi-layered retinas capable of perceiving ultraviolet, infrared, and polarized light. Their tympanic membranes detect micro-vibrations, allowing them to hear movement through dense foliage. Olfactory arrays in their nasal passages analyze chemical signatures with laboratory-level precision. Neural pathways optimized for rapid sensory integration give them near-instant threat recognition. Their musculature supports silent movement, with vibrationdampening joints and soft-tissue footpads that allow them to traverse dense forests without sound.

Environmental Adaptation. Kethari evolved in forests where predators relied on stealth and camouflage. Heightened senses allowed them to detect threats before ambush and track prey across complex terrain. Their ability to interpret environmental cues — scent gradients, micro-vibrations, polarized light — made them apex trackers long before they developed civilization. Their sensory acuity shaped their social structures, hunting strategies, and early communication systems.

Migration Pattern. Kethari are widely distributed across colonies requiring scouting, tracking, environmental monitoring, or search-and-rescue operations. Their sensory abilities make them indispensable in early-warning systems and intelligence networks. They adapt well to multispecies environments due to their observational nature and ability to read subtle social cues.

Star Force Suitability. Reconnaissance, intelligence gathering, sensor operations, perimeter security. Their sensory acuity makes them invaluable in early-warning systems and long-range detection roles. They excel in missions requiring stealth, precision, and environmental awareness.

Cultural Notes. Kethari culture is territorial, watchful, and governed by predator etiquette. Status comes from reading danger first, holding hunting ground, and proving restraint when every instinct favors pursuit. Clans mark borders with layered scent codes and treat an unnoticed intrusion as either a deliberate challenge or evidence of dangerous incompetence. Their contests emphasize stalking, ambush, and controlled takedowns; mercy is respected only when granted from a position of unmistakable advantage. Their art preserves the sensory imprint of famous hunts through scent, vibration, ultraviolet pattern, and reconstructed sound.`,
    accent: "#FBBF24",
    icon: "eye",
    order: 3,
  },
  {
    name: "Vhalen",
    slug: "vhalen",
    category: "species",
    description: `Homeworld: Aurora
Environment: High-radiation crystalline world scoured by photonic storms
Primary Ability: Energy manipulation through crystalline organ arrays

Physiology. Living crystal is threaded through the Vhalen nervous system — arrays that drink ambient radiation and hold it as charge. They can spend that charge as directed light or scalding heat, or bleed it out as a concussive electromagnetic pulse.

Adaptation. On a world where a photonic storm could blind or cook anything caught in the open, the Vhalen learned to bank the storm inside their own bodies and release it later. They eat lightning and save the meal.

Field Role. Power systems, shielding, and any operation where the environment itself is an energy hazard.

Culture. Vhalen rank one another by stored charge. Their most honoured are the "spent" — those who have emptied everything, deliberately, to cover someone else.`,
    accent: "#22D3EE",
    icon: "zap",
    order: 4,
  },
  {
    name: "Orren",
    slug: "orren",
    category: "species",
    description: `Homeworld: Chronar Prime
Environment: Relativistic orbit world with extreme time-lag light cycles
Primary Ability: Probability perception — deep, nonmystical pattern recognition

Physiology. Orren cognition runs a continuous model of consequence. Their brains weight past sequences so heavily that likely next-events surface as near-sensation. They do not see the future; they cannot stop calculating it.

Adaptation. On a world where a single sky-cycle spanned generations, survival went to those who predicted rather than witnessed. The Orren who guessed wrong died before the light returned.

Field Role. Strategic forecasting, logistics, and threat modelling — they are the ones who say "this goes wrong in nine minutes."

Orren treat certainty as a vice. Their highest compliment is "I didn't expect you," because it means a mind outpaced theirs.`,
    accent: "#22D3EE",
    icon: "clock",
    order: 5,
  },
  {
    name: "Brokk",
    slug: "brokk",
    category: "species",
    description: `Homeworld: Gravethar
Environment: A 4.2g basalt world ribbed with tectonic shear
Primary Ability: High-gravity endurance

Physiology. Brokk are dense — thick-boned, low-slung, muscle packed for load rather than speed. Every organ is anchored to run at four times Earth weight without failing.

Adaptation. On Gravethar, falling killed. Brokk biology became a study in never being knocked down: their grip is engineered for load, their mass for impact, their skeleton for hits that would shatter lighter species.

Field Role. Heavy industry, boarding actions, and any task where gravity or an enemy would simply break someone else.

Culture. Brokk keep one ritual law — whoever reaches the summit first must carry the slowest one back down. Strength unspent on others is called dead weight.`,
    accent: "#F97316",
    icon: "weight",
    order: 6,
  },
  {
    name: "Meruun",
    slug: "meruun",
    category: "species",
    description: `Homeworld: Silthar
Environment: High-pressure abyssal ocean trenches
Primary Ability: Amphibious pressure control

Physiology. A Meruun body holds its own internal pressure — a sealed, flexible architecture that lets them cross from crushing depth to open air without bends or collapse. They read pressure the way others read temperature.

Adaptation. They came from trenches where the water itself was a weapon, and learned to carry the deep inside them. Neither surface nor abyss is foreign to a Meruun.

Field Role. Deep-water operations, recovery, and any crossing between environments that would kill a surface species en route.

Meruun speak in slow, deliberate cadence — the habit of a world where rushing changes pressure, and pressure kills. Interrupting one is a grave insult.`,
    accent: "#0EA5E9",
    icon: "droplets",
    order: 7,
  },
  {
    name: "Kessa",
    slug: "kessa",
    category: "species",
    description: `Homeworld: Kael Myr
Environment: Dense fungal forest world, hunted by swarms
Primary Ability: Swarm coordination through quantumlinked biology

Physiology. An individual Kessa is small and unremarkable; what matters is the link. A shared field carries thought between bodies instantly, so a thousand Kessa act as one mind with a thousand hands.

Adaptation. Against predators that hunted in coordinated swarms, the Kessa answered in kind — and out-linked them. No lone hunter can out-think a species that shares a single thought.

Field Role. Coordinated operations, distributed sensing, and anything requiring many units to move as one.

Culture. Kessa have no concept of private thought — minds are weather to them. Their art is the deliberate holding of one idea by ten thousand minds at once.`,
    accent: "#E879F9",
    icon: "users",
    order: 8,
  },
  {
    name: "Ferrin",
    slug: "ferrin",
    category: "species",
    description: `Homeworld: Therit
Environment: Magnetar-influenced world of intense EM storms
Primary Ability: Electromagnetic sensing

Physiology. Ferrin perceive the world as a magnetic map — field lines, metal, current, and the charge of living bodies, all rendered in a sense that involves no light. They navigate by reading a room's fields.

Adaptation. On a world where storms blinded every eye, the Ferrin simply stopped needing sight. They orient by the hum of the planet's own magnetism.

Field Role. Detection, counter-surveillance, and operations in total darkness or heavy interference.

Ferrin greet by touching fields — a handshake of charge that reveals whether you are calm or lying. To them, a poker face is meaningless.`,
    accent: "#E6A817",
    icon: "waves",
    order: 9,
  },
  {
    name: "Lyren",
    slug: "lyren",
    category: "species",
    description: `Homeworld: Auralis
Environment: Resonant cavern world with harmonic wind tunnels
Primary Ability: Resonance communication

Physiology. A Lyren body is an instrument. Hollow chambers in chest and skull shape sound precisely enough to speak across kilometres through stone, and their skin reads returning vibrations as speech.

Adaptation. In caverns where sight ended at the next wall, survival belonged to whoever could map the dark by voice — and hear an answer.

Field Role. Communications, subterranean operations, and search-and-rescue where radio dies.

Culture. Lyren name themselves by a tonal signature, not a word. A Lyren's true name is the note that, sung, makes their family cavern ring back.`,
    accent: "#34D399",
    icon: "gem",
    order: 10,
  },
  {
    name: "Corma",
    slug: "corma",
    category: "species",
    description: `Homeworld: Umbrax
Environment: Low-light world of dense shadow forests
Primary Ability: Stealth adaptation

Physiology. Corma skin drinks light instead of reflecting it, and their movement is built for stillness — a metabolism that can idle for hours, with reflexes tuned to burst only at the moment of contact.

Adaptation. In forests where being spotted meant being eaten, the Corma evolved not to exist to the eye. They cast almost no shadow and give off almost no heat.

Field Role. Infiltration, ambush, and covert extraction.

Corma hold a taboo against being photographed — they consider their image a thing that can be stolen, and a stolen image a kind of death.`,
    accent: "#8B5CF6",
    icon: "eclipse",
    order: 11,
  },
  {
    name: "Nyra",
    slug: "nyra",
    category: "species",
    description: `Homeworld: Nythor
Environment: Low-gravity aerial world
Primary Ability: Aerial maneuvering

Physiology. Nyra are light, hollow-boned, and membranewinged, built to live in three dimensions. Their inner ear reads subtle gravity gradients, letting them ride a thermal they cannot see.

Adaptation. On a world of floating islands and thin air, the Nyra never had to fight gravity — only to negotiate with it.

Field Role. Aerial reconnaissance, high-altitude insertion, and courier work.

Culture. Nyra have no word for "ground" that is not also their word for "grave." Landfall is a comfort they distrust.`,
    accent: "#7DD3FC",
    icon: "wind",
    order: 12,
  },
  {
    name: "Durok",
    slug: "durok",
    category: "species",
    description: `Homeworld: Orvax Prime
Environment: Metallic super-planet with constant seismic activity
Primary Ability: Armored durability

Physiology. Durok grow a mineral shell in layered plates, shed and reforged as they age. Their biology files rock into armour the way others build scar tissue — and it never stops.

Adaptation. On a world that never stopped shaking, the survivor was the one who could be hit and remain. Soft tissue was a liability; the Durok replaced what they could.

Field Role. Front-line assault and structure breach, in environments where being crushed is expected.

Culture. Durok greet by showing their oldest scar-plate. A smooth shell is an embarrassment — proof of a life spent safely, and therefore meaninglessly.`,
    accent: "#94A3B8",
    icon: "mountain",
    order: 13,
  },
  {
    name: "Vedan",
    slug: "vedan",
    category: "species",
    description: `Homeworld: Vedae — Radiation-rich nebula world. Primary Ability: Radiation & EM embodiment.

Physiology Summary. Vedan bodies contain radiationabsorbing organelles that convert high-energy particles into metabolic fuel. Their skin is reinforced with EM-diffusion layers that prevent cellular damage. Their blood carries radiationbinding proteins that neutralize harmful particles. Vedan neural pathways include EM-buffering structures that protect against ion surges.

Environmental Adaptation. Vedae's nebula regions exposed early Vedan organisms to constant radiation storms. Vedan evolved to absorb radiation rather than resist it, allowing them to thrive in environments that would sterilize most species. Their ability to convert radiation into energy gave them metabolic advantages in high-EM environments.

Migration Pattern. Vedan are common in reactor operations, radiation research, and EM hazard zones. Their abilities make them valuable in electronic warfare and energy-field stabilization. They integrate well into multispecies societies but often prefer environments with high EM activity.

Star Force Suitability. Hazard ops, reactor teams, electronic warfare, energy-field specialists. Vedan excel in roles requiring radiation tolerance and EM manipulation.

Cultural Notes. Vedan culture values endurance, transformation, and harmony with energetic environments. Rituals often involve controlled radiation displays, and their art incorporates glowing materials that respond to EM fields.`,
    accent: "#FBBF24",
    icon: "sun",
    order: 14,
  },
  {
    name: "Ossaric",
    slug: "ossaric",
    category: "species",
    description: `Homeworld: Lithovar
Environment: Stone-dense, low-oxygen moon
Primary Ability: Living stone physiology

Physiology. Ossaric are part-silicate — a body that mineralises as it ages, slow and patient and nearly impossible to kill. They eat minerals, breathe little, and heal by regrowth rather than repair.

Adaptation. On a moon that could barely feed a metabolism, the Ossaric became the slowest and most durable thing on it — a life that outlasts the weather.

Field Role. Long-duration deployment, archaeology, and siege work — anything measured in decades.

Culture. Ossaric reckon time by the wearing-down of stone, and carve their records into their own bodies. An elder Ossaric is a walking history.`,
    accent: "#A3E635",
    icon: "box",
    order: 15,
  },

  // ---- Section II — Species 16–30 ----------------------------------------
  {
    name: "Gorrud",
    slug: "gorrud",
    category: "species",
    description: `Homeworld: Dunmar
Environment: Basalt canyons crushed under a thick, heavy sky
Primary Ability: Load-bearing musculature — muscle that compresses into strength

Physiology. A Gorrud's muscle does not tear under load; it locks. Banded fibres cinch tighter the harder the world presses, and a secondary organ bleeds off the pressure difference so a body raised in the deep can cross to thin air without rupturing.

Adaptation. Dunmar's atmosphere presses down like a hand on the shoulders. The Gorrud never fought it — they grew into it, and made the weight into footing.

Field Role. Heavy-world deployment, pressure-hull repair, deep-canyon assault.

Culture. A Gorrud measures a person by what they can still carry while the world leans on them. Light worlds unsettle them; they call thin air "the empty room."`,
    accent: "#F97316",
    icon: "shield",
    order: 16,
  },
  {
    name: "Nymer",
    slug: "nymer",
    category: "species",
    description: `Homeworld: Ysolde
Environment: Glowing wetlands whose microbial mats answer light with light
Primary Ability: Skin that signals in living colour

Physiology. Symbiotic luminous microbes live in a Nymer's dermis, and their chemistry follows the host's. Mood, intent, and health all bleed out as hue and pulse — a body that cannot help but be read.

Adaptation. In wetlands where sight is a negotiation and the ground glows back, language became light. A Nymer's ancestors spoke in colour long before they had words.

Field Role. Silent signalling, dark-operations coordination, living-sensor work.

Culture. A Nymer's oldest writing is a light-pattern that must be watched to be read. To call someone "dim" is their gravest insult.`,
    accent: "#E879F9",
    icon: "feather",
    order: 17,
  },
  {
    name: "Caelith",
    slug: "caelith",
    category: "species",
    description: `Homeworld: Haleth
Environment: Wind-scoured plateaus under a sky that never stops moving
Primary Ability: A skeleton built like a wing — hollow, braced, and self-trimming

Physiology. Strut-hollow bones, a keel, and layered flaps along the spine let a Caelith trim their own surface like a sail. Pressure pits behind the jaw read the invisible shape of the wind.

Adaptation. Haleth's shear never let up, so the Caelith grew to live braced. They do not shelter from wind; they align to it.

Field Role. High-altitude insertion, tower and cliff work, gust-borne reconnaissance.

Culture. A windless day unnerves them. They call it "the held breath," and wait for the world to exhale.`,
    accent: "#7DD3FC",
    icon: "wind",
    order: 18,
  },
  {
    name: "Suran",
    slug: "suran",
    category: "species",
    description: `Homeworld: Undral
Environment: A labyrinth of lava-tubes where the only reliable map is warmth
Primary Ability: Reading heat as shape

Physiology. A lattice of thermoreceptors lets a Suran feel a cave system's temperature before entering it — every passage, every dead end, printed in degrees. They see stone by how it holds the day's heat.

Adaptation. Undral's tubes shift and seal without warning. Those who saw only by light died in the collapses; those who felt the warmth lived.

Field Role. Subterranean navigation, collapse rescue, geothermal survey.

Culture. Suran greet by pressing a palm to stone and reading the room back. They consider a wall "silent" the rudest thing it can be.`,
    accent: "#F77F2A",
    icon: "flame",
    order: 19,
  },
  {
    name: "Sarrix",
    slug: "sarrix",
    category: "species",
    description: `Homeworld: Calex
Environment: Crystal reefs that bend their own light into false rooms
Primary Ability: Refractive sight — the body bends light, the eye reads the fold

Physiology. Faceted lenses split the spectrum, and a Sarrix's skin refracts light around them, shifting where they seem to stand. They can be half a step from where they appear.

Adaptation. On Calex the reefs lied for a living — mirage and misdirection were the tide. The Sarrix learned to be the best lie in the water.

Field Role. Optical deception, surveillance, covered movement.

Culture. A Sarrix greeting can be true and false at once. They find plain bluntness almost rude.`,
    accent: "#34D399",
    icon: "gem",
    order: 20,
  },
  {
    name: "Dazil",
    slug: "dazil",
    category: "species",
    description: `Homeworld: Daharra
Environment: A white desert under a sun that both kills and feeds
Primary Ability: Drinking sunlight into stored fuel

Physiology. Skin cells convert light into slow heat, held in deep stores and burned for motion. A Dazil eats rarely and glows faintly after long exposure.

Adaptation. On Daharra the sun was the only dependable thing — killer and meal at once. The Dazil learned to live off it.

Field Role. Long desert patrols, sun-rich deployments, resupply-free campaigns.

Culture. Their calendar is written in light. They count the days by how much the sun hurts, and greet at noon.`,
    accent: "#FBBF24",
    icon: "sun",
    order: 21,
  },
  {
    name: "Cobrik",
    slug: "cobrik",
    category: "species",
    description: `Homeworld: Voln
Environment: Metal plains where ferrous lightning walks the ground
Primary Ability: Conducting and stowing charge along mineralised nerves

Physiology. Mineralised nerve-lines let a Cobrik drink a lightning strike and hold it — a low hum under the skin — until it is spent through the fingertips.

Adaptation. Voln's storms hunted anything that stood tall. The Cobrik stopped resisting the strike and became the wire that survived it.

Field Role. Power systems, EMP zones, turning an enemy's own charge against them.

Culture. Cobrik debt is measured in charge — literally stored, literally paid. A defaulted debt leaves a mark that tingles.`,
    accent: "#E6A817",
    icon: "zap",
    order: 22,
  },
  {
    name: "Moorn",
    slug: "moorn",
    category: "species",
    description: `Homeworld: Skiel
Environment: Floating islands adrift on slow, breathing air
Primary Ability: Reading and nudging the faintest currents

Physiology. Fine membranes along the arms and back read pressure and steer it. A Moorn is light enough to be moved by a breath and precise enough to choose the direction.

Adaptation. On Skiel, steering the air was the whole of survival. The islands went where the wind did; the Moorn went where they wished.

Field Role. Silent aerial drift, weather-sense, air-borne infiltration.

Culture. They navigate by the smell of a current. "The wind remembers" is their phrase for a grudge.`,
    accent: "#7DD3FC",
    icon: "feather",
    order: 23,
  },
  {
    name: "Kaldar",
    slug: "kaldar",
    category: "species",
    description: `Homeworld: Hrimfell
Environment: Crystal tundra buried under a winter that never breaks
Primary Ability: Pausing the metabolism and starting it again

Physiology. Antifreeze proteins and a metabolism that can go silent let a Kaldar sit near-death for weeks and return. Cold does not kill them; it merely slows the clock.

Adaptation. Hrimfell's storms were measured in seasons, not hours. Survival meant outlasting the cold, never beating it.

Field Role. Polar deployment, long-silence posting, endurance under freeze.

Culture. Their year turns on "the return" — the waking. Those who do not wake are said to be "still deciding."`,
    accent: "#818CF8",
    icon: "moon",
    order: 24,
  },
  {
    name: "Cirrin",
    slug: "cirrin",
    category: "species",
    description: `Homeworld: Ionhal
Environment: Cloud forests drowned in charged mist
Primary Ability: Breathing the storm

Physiology. Lungs that pull moisture and charge from the air, and filaments that taste the ion content of the mist, let a Cirrin live where others suffocate.

Adaptation. On Ionhal the air was thin and electric — no good for ordinary lungs. The Cirrin stopped treating the sky as empty.

Field Role. High-atmosphere reconnaissance, ion-storm tracking, cloud-layer insertion.

Culture. They hold that breath is borrowed from the storm and must be returned. Dying, for a Cirrin, is "giving it back."`,
    accent: "#38BDF8",
    icon: "waves",
    order: 25,
  },
  {
    name: "Hesper",
    slug: "hesper",
    category: "species",
    description: `Homeworld: Mycel
Environment: Fungal caverns where the very air is a poison
Primary Ability: Breaking biotoxins down into harmlessness

Physiology. Blood chemistry that cracks spores into inert salts, plus gut symbionts that eat what the blood leaves. A Hesper can walk through a killing bloom breathing easily.

Adaptation. In Mycel's caverns the air killed quietly. The Hesper became the ones who could inhale what everyone else ran from.

Field Role. Hostile-atmosphere entry, decontamination, containment.

Culture. They trade spores as currency and keep their filters on in public — a bare face is something only family sees.`,
    accent: "#4ADE80",
    icon: "shield",
    order: 26,
  },
  {
    name: "Nadir",
    slug: "nadir",
    category: "species",
    description: `Homeworld: Thalass
Environment: A crushing ocean on a world that pulls twice as hard as it should
Primary Ability: Moving within water that means to flatten you

Physiology. Dense, compact, and built around a pump that corrects for pressure, a Nadir sinks or rises at will and works where water and gravity agree to kill.

Adaptation. On Thalass, depth and weight were the same problem. Those who could not balance them never came back up.

Field Role. Deep-ocean heavy work, salvage, gravity-well diving.

Culture. They measure the sea in "layers of the world" and revere anyone who has been to the bottom and returned.`,
    accent: "#0EA5E9",
    icon: "droplets",
    order: 27,
  },
  {
    name: "Brasque",
    slug: "brasque",
    category: "species",
    description: `Homeworld: Cindra
Environment: Plains that breathe steam and move their vents without warning
Primary Ability: Cycling heat in and out as needed

Physiology. Vent rows along the back take in ground-heat and release it on command — warm to move, cool to hide, never quite still.

Adaptation. Cindra's ground opened and closed. Warmth was mobility; a Brasque that lost its heat was a Brasque that could not run.

Field Role. Geothermal zones, lava-field crossing, thermal detection.

Culture. Brasque storytellers speak slowly, because their world never let a tale finish unchallenged.`,
    accent: "#F77F2A",
    icon: "flame",
    order: 28,
  },
  {
    name: "Hollis",
    slug: "hollis",
    category: "species",
    description: `Homeworld: Verdance
Environment: A canopy world where everything grows toward one light
Primary Ability: Living partly on light

Physiology. Green-veined skin photosynthesises; a Hollis eats only to top up and slows with the sun. In darkness they dim like a wick.

Adaptation. On Verdance the canopy was a single slow machine of light. The Hollis grew into it, patient as the leaves.

Field Role. Long ground reconnaissance, arboreal operations, low-supply campaigns.

Culture. They keep daylight rituals and hold a "night-walk" — a rite in which one crosses the dark deliberately weakened.`,
    accent: "#4ADE80",
    icon: "sun",
    order: 29,
  },
  {
    name: "Klaven",
    slug: "klaven",
    category: "species",
    description: `Homeworld: Echolm
Environment: Metal caverns that answer every sound with a crowd of echoes
Primary Ability: Navigating by reflected sound

Physiology. A Klaven emits a low pulse through a throat-sac and reads what the metal sends back. A warren becomes a lit room in their mind.

Adaptation. In Echolm's mirrored dark, sight was useless. The Klaven traded eyes for ears and never missed them.

Field Role. Sensor-free navigation, blackout operations, searching collapsed structures.

Culture. A Klaven name is a shaped echo, not a word — and it is considered wrong to write one down.`,
    accent: "#94A3B8",
    icon: "waves",
    order: 30,
  },

  // ---- Section III — Species 36–50 ---------------------------------------
  // Numbers 31–35 were absent from the source document.
  {
    name: "Ullan",
    slug: "ullan",
    category: "species",
    description: `Homeworld: Rushmar
Environment: River canyons where the water runs fast enough to cut stone
Primary Ability: Steering water with the limbs

Physiology. Grooved limbs and micro-vanes let an Ullan feel a current's seams and push against them, so a body that looks too heavy rides white water like a leaf.

Adaptation. On Rushmar the rivers were the roads and the executioners both. The Ullan learned to argue with them.

Field Role. Rapid-water operations, canyon rescue, currentborne insertion.

Culture. They bury their dead in the current facing upstream — "so they can come back when they are ready."`,
    accent: "#38BDF8",
    icon: "droplets",
    order: 36,
  },
  {
    name: "Sorel",
    slug: "sorel",
    category: "species",
    description: `Homeworld: Ashvel
Environment: Ash-plains smouldering over coals that never fully die
Primary Ability: Raising the body's own temperature to ignition

Physiology. A Sorel's metabolism can be stoked like a fire — heat rises in the chest, breath comes out hot, and the skin reddens to a banked glow.

Adaptation. Ashvel's ground was warm everywhere and safe nowhere. To run hot was to cross it.

Field Role. Cold-environment endurance, ash-field crossing, close combat where heat is the weapon.

Culture. A Sorel in grief is said to "go cold," and to warm again is their word for healing.`,
    accent: "#EF4444",
    icon: "flame",
    order: 37,
  },
  {
    name: "Versine",
    slug: "versine",
    category: "species",
    description: `Homeworld: Resonne
Environment: Crystal caverns that drink and return stored energy
Primary Ability: Tuning with resonant fields

Physiology. Bone plates ring at set frequencies; a Versine can match the hum of a crystal field and bank its charge, or scatter it before it lands.

Adaptation. In Resonne's caverns a wrong note woke the stone. The Versine survived by learning the cavern's song by heart.

Field Role. Energy-field control, resonance shielding, mine and trap clearance.

Culture. They tune their instruments to the cave they live in, and every Versine family keeps its own chord.`,
    accent: "#34D399",
    icon: "gem",
    order: 38,
  },
  {
    name: "Karrow",
    slug: "karrow",
    category: "species",
    description: `Homeworld: Sear
Environment: Metal deserts scoured by charged grit storms
Primary Ability: Skin that shrugs off abrasive particles

Physiology. Overlapping scutes and a slick outer layer let charged grit slide off. A Karrow can walk a storm that strips the paint from a hull.

Adaptation. On Sear the wind carried the whole desert. The Karrow grew a hide the desert could not eat.

Field Role. Storm-zone transit, grit-heavy deployments, hullside repair.

Culture. They keep their scutes polished and read a stranger's wear as a life story.`,
    accent: "#F97316",
    icon: "shield",
    order: 39,
  },
  {
    name: "Grellan",
    slug: "grellan",
    category: "species",
    description: `Homeworld: Rotmere
Environment: Fungal jungles whose air carries a slow, sweet poison
Primary Ability: Filtering neurotoxins from the blood

Physiology. A two-stage liver and dense capillary sieves clear toxins before they reach the nerves. A Grellan can walk a sporecloud that would stop a heart.

Adaptation. In Rotmere the air was the trap. The Grellan bred the skill to breathe through it and outlast it.

Field Role. Toxic-zone operations, epidemic response, poison-hazard entry.

Culture. They brew with what others brew against. A Grellan apology is a cup of something bitter.`,
    accent: "#4ADE80",
    icon: "shield",
    order: 40,
  },
  {
    name: "Sollow",
    slug: "sollow",
    category: "species",
    description: `Homeworld: Deepfall
Environment: Deep trenches where the dark is hunted by lights
Primary Ability: Counter-illumination — going unseen in a world of light

Physiology. Photophores on the belly match the light above them, and a Sollow's outline dissolves against the glow of what swims overhead. They hide by glowing exactly enough.

Adaptation. On Deepfall's floor, prey hunted by lamp-light. The Sollow survived by becoming the glow — a shadow made of light.

Field Role. Deep-stealth operations, bioluminescent-environment reconnaissance, silent retreat.

Culture. A Sollow's most sacred word translates as "the dark that is not empty."`,
    accent: "#0EA5E9",
    icon: "sparkles",
    order: 41,
  },
  {
    name: "Nival",
    slug: "nival",
    category: "species",
    description: `Homeworld: Grimhollow
Environment: Glacial plains cut by charged, freezing wind
Primary Ability: Holding heat against a wind that wants it gone

Physiology. Layered keratin traps a static thermal shell, and the charge in the air is bled off harmlessly rather than spending the body's warmth. A Nival stays warm to the core while the wind howls.

Adaptation. Grimhollow's cold came not from the ground but from the air itself — charged and hungry. The Nival learned to armour not against cold but against theft.

Field Role. Cold-wind deployment, ice-field endurance, charged-storm crossing.

Culture. They greet by sharing a short breath of warm air. To refuse is to refuse the friendship outright.`,
    accent: "#818CF8",
    icon: "moon",
    order: 42,
  },
  {
    name: "Arclen",
    slug: "arclen",
    category: "species",
    description: `Homeworld: Reefmoor
Environment: Coral forests where living things hunt with voltage
Primary Ability: Making the body's own lightning

Physiology. Muscle cells double as batteries, discharging through the hands in a bright, sudden arc. An Arclen stuns before it strikes.

Adaptation. In Reefmoor's waters the predators carried their own storm. The Arclen answered by growing one of their own.

Field Role. Close-quarters defence, electrified environments, non-lethal takedown.

Culture. They speak of anger as "carrying a charge," and consider a public discharge deeply embarrassing.`,
    accent: "#E6A817",
    icon: "zap",
    order: 43,
  },
  {
    name: "Velleth",
    slug: "velleth",
    category: "species",
    description: `Homeworld: Murkmere
Environment: Fog plains thick enough to swallow sound
Primary Ability: Seeing through what should be blind

Physiology. Skin that reads the pressure wakes of moving bodies, and a low-light eye, let a Velleth track what the mist hides. Nothing crosses their fog unseen.

Adaptation. In Murkmere's milk-thick air, attackers came from nowhere. The Velleth learned to read the nowhere.

Field Role. Low-visibility operations, ambush detection, silent approach.

Culture. They say "the mist keeps no secrets" — meaning it keeps them all, and only the patient can read them.`,
    accent: "#8B5CF6",
    icon: "ghost",
    order: 44,
  },
  {
    name: "Stenn",
    slug: "stenn",
    category: "species",
    description: `Homeworld: Lodespan
Environment: Mineral forests where crystal grows and shifts like weather
Primary Ability: Feeling stone by its structure

Physiology. Dermal fibres quiver near certain minerals, so a Stenn reads the density and cut of the rock around them like a map written in stone.

Adaptation. On Lodespan the forest was stone, and the stone moved. The Stenn found their way by listening to a world that grew.

Field Role. Mineral-forest navigation, tunnel survey, ore-field scouting.

Culture. They carve their histories into the growth-lines of a crystal, and take an unhurried view of time.`,
    accent: "#94A3B8",
    icon: "mountain",
    order: 45,
  },
  {
    name: "Vinel",
    slug: "vinel",
    category: "species",
    description: `Homeworld: Tanglewood
Environment: Vine forests that grow a season in a single night
Primary Ability: Writhing, grasping limbs

Physiology. A Vinel's arms split into prehensile tendrils that grip and wrench. Their strength comes not from bone but from thousands of small, fast grabs.

Adaptation. On Tanglewood the forest strangled whatever stood still. The Vinel out-argued it with limbs that would not hold a shape.

Field Role. Climbing and grappling, entanglement and restraint, jungle pursuit.

Culture. They weave their halls from living cord and count a home's worth in how much of it is still growing.`,
    accent: "#4ADE80",
    icon: "feather",
    order: 46,
  },
  {
    name: "Rymel",
    slug: "rymel",
    category: "species",
    description: `Homeworld: Palewarren
Environment: Frozen caverns lit by ice that gives off its own glow
Primary Ability: Giving off a cold light

Physiology. A Rymel's skin plates emit a pale glow that brightens in the deepest cold — light born of frost rather than heat.

Adaptation. In Palewarren the only illumination was the ice itself. The Rymel stopped needing warmth in order to see.

Field Role. Polar cave operations, cold-signalling, night search-and-rescue.

Culture. They leave lights burning in empty rooms for those still walking the cold.`,
    accent: "#A78BFA",
    icon: "sparkles",
    order: 47,
  },
  {
    name: "Sulfen",
    slug: "sulfen",
    category: "species",
    description: `Homeworld: Cauldron
Environment: Volcanic tunnels thick with poisonous gas
Primary Ability: Breathing fumes without harm

Physiology. Layered lung lining and a blood chemistry that binds sulphur compounds let a Sulfen breathe what would choke a crowd.

Adaptation. In Cauldron's tunnels the air was the weapon. The Sulfen learned to drink it dry.

Field Role. Volcanic-zone operations, gas-choked entry, mine rescue.

Culture. They keep their voices low in tunnels, from an old belief that the mountain listens before it answers.`,
    accent: "#F77F2A",
    icon: "shield",
    order: 48,
  },
  {
    name: "Lodan",
    slug: "lodan",
    category: "species",
    description: `Homeworld: Shardplain
Environment: Gravity-twisted plains under a lattice of standing crystal
Primary Ability: Borrowing weight from resonant crystal

Physiology. A Lodan's core rides the hum of nearby crystal; they can shed apparent weight to leap, or draw it in to root themselves against a shove.

Adaptation. On Shardplain the pull of the world was uneven and always changing. The Lodan learned to borrow stability from the stone.

Field Role. Unstable-gravity work, heavy-field cargo handling, anchor and hold-fast roles.

Culture. Their architecture is hung from crystal pillars that carry the load, and they speak of "standing well" as the highest praise.`,
    accent: "#F97316",
    icon: "weight",
    order: 49,
  },
  {
    name: "Tesra",
    slug: "tesra",
    category: "species",
    description: `Homeworld: Thunderhead
Environment: A world roofed in a permanent storm
Primary Ability: Feeling the charge of the sky before it strikes

Physiology. A Tesra's crest reads the ion column above them, giving them the strike's place and moment a breath before it lands.

Adaptation. On Thunderhead the sky hunted continuously. The Tesra survived by never being surprised by it.

Field Role. Storm tracking, lightning-hazard operations, early warning for grounded teams.

Culture. They hold that the sky is not angry but simply honest, and that a Tesra's job is to listen, not to flinch.`,
    accent: "#E6A817",
    icon: "zap",
    order: 50,
  },
];
