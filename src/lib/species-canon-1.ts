// =========================================================================
// Delegate Species of the Orion Triangle — canon charter, part 1 (1–75).
//
// Verbatim transcription of the "Delegate Species of the Orion Triangle"
// charter document. Each entry preserves the species' homeworld,
// evolutionary environment, primary ability, Physiology Summary,
// Environmental Adaptation, Migration Pattern, Star Force Suitability,
// Cultural Notes, and (where the charter provides them) the physiology and
// role tables rendered inline. Wording is the canon document's own.
//
// Sections VII and VIII are absent from the charter as supplied; entries
// resume at Section IX (species 91+) in species-canon-2.ts.
// =========================================================================

import type { FactionSeed } from "./factions";

export const SPECIES_FACTIONS_1: FactionSeed[] = [
  // ---- Section I — Species 1–15 ------------------------------------------
  {
    name: "Velkarian",
    slug: "velkarian",
    category: "species",
    description:
      "Homeworld: Velkar Reach. Environment: Mineral forests and cavern networks with unstable terrain. Primary Ability: Biological shapeshifting (hard sci fi tissue restructuring).\n\nPHYSIOLOGY — Velkarians possess a morphogenic cellular matrix composed of adaptive stem clusters, elastic collagen webs, and neural responsive cytoskeletal proteins. Their cells reorganize under conscious control, enabling changes in limb length, dermal texture, facial structure, and body density. Rapid protein synthesis pathways and high efficiency ATP cycling prevent tissue necrosis during restructuring. Their nervous system includes proprioceptive feedback loops that maintain balance and coordination even as their form changes. Organs shift position within flexible membranes, allowing structural reconfiguration without compromising internal stability.\n\nENVIRONMENTAL ADAPTATION — Shapeshifting evolved as a survival mechanism in cavern ecosystems where predators hunted by silhouette and movement pattern. Velkarians adapted by altering their form to navigate tight spaces, mimic mineral formations, flatten against cavern walls, or slip through fissures. Their ability to compact or elongate their bodies allowed them to survive collapses and evade detection in crystalline forests. Over generations, this adaptation became refined into a conscious, precise biological capability.\n\nMIGRATION PATTERN — Velkarians spread widely due to their usefulness in exploration, infiltration, and hazardous terrain navigation. Their physiology allows them to adapt to local environmental demands, making them highly valued in frontier colonies and multispecies settlements. They integrate easily into diverse societies due to their ability to adjust their form to local norms and environmental constraints.\n\nSTAR FORCE SUITABILITY — Elite infiltration units, reconnaissance teams, undercover operations, adaptive survival specialists. Their shapeshifting gives them unmatched versatility in stealth and terrain specific missions, especially in environments where rigid physiology is a liability.\n\nCULTURAL NOTES — Velkarian culture values fluid identity, personal reinvention, and adaptability. Social rituals often involve controlled morph displays symbolizing trust, emotional openness, or artistic expression. Their art is kinetic, involving shifting forms rather than static sculpture, and their architecture often incorporates surfaces designed to interact with morph displays.",
    accent: "#C084FC",
    icon: "sparkles",
    order: 1,
  },
  {
    name: "Helioxian",
    slug: "helioxian",
    category: "species",
    description:
      "Homeworld: Heliox. Environment: Plasma active volcanic world with extreme thermal flux. Primary Ability: Living flame state (plasma vent biology).\n\nPHYSIOLOGY — Helioxians possess plasma vent organs embedded along the spine and shoulders. These organs channel ionized gases through dermal micro ducts, producing a controlled “flame state” where expelled plasma forms a fiery aura. Their skin is reinforced with ceramic protein composites capable of withstanding temperatures exceeding 2,000°C. Internal organs are shielded by silica carbon membranes that prevent thermal damage during plasma discharge. Their metabolism includes heat conversion pathways that transform thermal energy into biochemical fuel, allowing them to become stronger and more alert in high heat environments.\n\nENVIRONMENTAL ADAPTATION — Helioxians evolved in volcanic regions where plasma geysers and thermal storms were constant. Their flame state originally served as a defensive mechanism and a thermal regulator during sudden heat spikes. Plasma venting also allowed them to clear toxic gas pockets and deter predators. Over time, the flame state became a cultural symbol of resilience and transformation.\n\nMIGRATION PATTERN — Helioxians are common in reactor maintenance, plasma engineering, and hazardous industrial zones. Their physiology makes them ideal for environments requiring extreme heat tolerance. They are frequently employed in frontier colonies where thermal hazards are frequent and conventional species cannot operate safely.\n\nSTAR FORCE SUITABILITY — Hazard ops, fire suppression units, plasma environment specialists, breaching teams. Their flame state can be used for intimidation, distraction, or controlled thermal cutting, making them valuable in both combat and engineering contexts.\n\nCULTURAL NOTES — Helioxian culture centers on transformation and endurance. Ritual flame dances symbolize resilience, emotional catharsis, and communal unity. Their architecture incorporates heat shaped stone and plasma etched metal, creating structures that glow faintly with residual thermal energy. Helioxian art often involves controlled plasma emissions used to sculpt or illuminate their surroundings.",
    accent: "#EF4444",
    icon: "flame",
    order: 2,
  },
  {
    name: "Kethari",
    slug: "kethari",
    category: "species",
    description:
      "Homeworld: Kethar. Environment: Predator dense forest world with extreme sensory competition. Primary Ability: Heightened multisensory perception.\n\nPHYSIOLOGY — Kethari is a felinoid/humanoid hybrid that possesses multi layered retinas capable of perceiving ultraviolet, infrared, and polarized light. Their tympanic membranes detect micro vibrations, allowing them to hear movement through dense foliage. Olfactory arrays in their nasal passages analyze chemical signatures with laboratory level precision. Neural pathways optimized for rapid sensory integration give them near instant threat recognition. Their musculature supports silent movement, with vibration dampening joints and soft tissue footpads that allow them to traverse dense forests without sound.\n\nENVIRONMENTAL ADAPTATION — Kethari evolved in forests where predators relied on stealth and camouflage. Heightened senses allowed them to detect threats before ambush and track prey across complex terrain. Their ability to interpret environmental cues — scent gradients, micro vibrations, polarized light — made them apex trackers long before they developed civilization. Their sensory acuity shaped their social structures, hunting strategies, and early communication systems.\n\nMIGRATION PATTERN — Kethari are widely distributed across colonies requiring scouting, tracking, environmental monitoring, or search and rescue operations. Their sensory abilities make them indispensable in early warning systems and intelligence networks. They adapt well to multispecies environments due to their observational nature and ability to read subtle social cues.\n\nSTAR FORCE SUITABILITY — Reconnaissance, intelligence gathering, sensor operations, perimeter security. Their sensory acuity makes them invaluable in early warning systems and long range detection roles. They excel in missions requiring stealth, precision, and environmental awareness.\n\nCULTURAL NOTES — Kethari culture values awareness, patience, and observational mastery. Storytelling often involves sensory reenactments that recreate the sights, sounds, and scents of historical events. Their art emphasizes subtlety and environmental harmony, often incorporating natural materials that enhance sensory experience.",
    accent: "#FBBF24",
    icon: "eye",
    order: 3,
  },
  {
    name: "Auroran",
    slug: "auroran",
    category: "species",
    description:
      "Homeworld: Aurora. Environment: High radiation crystalline world with photonic storms. Primary Ability: Energy manipulation (crystalline organ arrays; EM absorption and emission).\n\nPHYSIOLOGY — Aurorans possess crystalline organ clusters embedded beneath the skin that absorb, store, and redirect electromagnetic energy. These organ arrays connect to photonic channels that run through the body, allowing controlled emission of light, EM pulses, or radiation bursts. Their cells contain radiation resistant proteins that prevent DNA damage from high energy particle exposure. Auroran neural pathways include EM buffering sheaths that protect against photonic surges, enabling them to operate in environments that would sterilize most life. Their dermal layers refract light, giving them a faint iridescent sheen under certain wavelengths.\n\nENVIRONMENTAL ADAPTATION — Aurorans evolved in crystalline forests where photonic storms swept across the landscape with unpredictable intensity. Excess radiation was lethal to early organisms, but Aurorans adapted by converting high energy particles into metabolic fuel. Their energy manipulation originally served as a defensive mechanism, allowing them to blind predators or disrupt their sensory systems. In low visibility crystalline terrain, controlled light emission became a form of communication, enabling coordinated movement through refractive labyrinths.\n\nMIGRATION PATTERN — Aurorans are common in energy research facilities, reactor systems, communication hubs, and sensor arrays. Their ability to stabilize EM fields makes them valuable in high tech colonies and starship operations. They integrate well into multispecies settlements due to their calm demeanor and ability to regulate ambient radiation levels.\n\nSTAR FORCE SUITABILITY — Electronic warfare, signal operations, energy field stabilization, sensor calibration. Their EM emission capabilities make them ideal for counter sensor operations and battlefield illumination in low visibility environments.\n\nCULTURAL NOTES — Auroran culture is visually expressive. Communication often includes controlled light emissions that convey emotional states or social intent. Rituals involve synchronized photonic displays representing historical narratives or communal identity. Their architecture incorporates crystalline structures that refract light into shifting patterns, creating living murals that change with the time of day.",
    accent: "#22D3EE",
    icon: "zap",
    order: 4,
  },
  {
    name: "Chronari",
    slug: "chronari",
    category: "species",
    description:
      "Homeworld: Chronar Prime. Environment: Relativistic orbit world with extreme time lag light cycles. Primary Ability: Probability perception (advanced pattern recognition; non mystical).\n\nPHYSIOLOGY — Chronari possess neural structures capable of processing vast sensory data at extreme speed. Their brains analyze motion vectors, EM fluctuations, environmental cues, and micro patterns to predict likely outcomes. This creates the impression of “probability sense,” but it is purely analytical. Their visual cortex compensates for relativistic light distortion, allowing them to perceive motion with clarity even when light arrives delayed or warped. Chronari reflexes are exceptionally fast, supported by high density neural clusters optimized for predictive cognition.\n\nENVIRONMENTAL ADAPTATION — Chronar Prime’s relativistic orbit created time lagged light cycles where predators appeared in multiple positions simultaneously due to visual distortion. Chronari evolved advanced pattern recognition to anticipate movement and environmental changes. Their ability to model probable outcomes allowed them to avoid predators, navigate shifting terrain, and coordinate group movement in environments where sensory input was unreliable.\n\nMIGRATION PATTERN — Chronari are highly valued in navigation, intelligence, tactical analysis, and scientific modeling. They are frequently employed in starship command centers, research stations, and strategic planning divisions. Their predictive abilities make them indispensable in crisis response and battlefield coordination.\n\nSTAR FORCE SUITABILITY — Strategic analysis, sensor interpretation, threat prediction, command support. Chronari excel in roles requiring rapid assessment of complex data and anticipation of enemy movement.\n\nCULTURAL NOTES — Chronari culture values foresight, planning, and intellectual discipline. Decision making rituals involve communal prediction exercises where participants model possible futures based on shared data. Chronari storytelling emphasizes cause and effect relationships and the consequences of small actions across long timescales.",
    accent: "#22D3EE",
    icon: "clock",
    order: 5,
  },
  {
    name: "Trovians",
    slug: "trovians",
    category: "species",
    description:
      "Homeworld: Gravethar. Environment: 4.2g basalt world with tectonic shear. Primary Ability: High gravity endurance.\n\nPHYSIOLOGY — Gravethari musculature is composed of triple helix myofibrils capable of contracting under extreme load without tearing. Their bones contain iron silicate composites that provide mass and rigidity. A dual pump heart maintains circulation under crushing pressure, while silica reinforced skin resists abrasion and heat pockets from mantle vents. Their vestibular system recalibrates instantly between gravity levels, preventing disorientation when transitioning from high gravity to standard gravity environments.\n\nENVIRONMENTAL ADAPTATION — Gravethar’s basalt trenches required compact frames and immense strength to navigate. Constant tectonic shear created sudden shifts in terrain, forcing Gravethari to evolve bodies capable of absorbing shock and maintaining stability. Their physiology is optimized for endurance, allowing them to operate in environments where most species would collapse under gravitational stress.\n\nMIGRATION PATTERN — Gravethari are common in mining colonies, heavy industry systems, and frontier construction fleets. Their strength and stability make them ideal for structural engineering, asteroid mining, and hazardous manual labor. They adapt well to multispecies environments but often prefer roles that emphasize physical reliability.\n\nSTAR FORCE SUITABILITY — Heavy infantry, breachers, boarding units, exosuit operators. Gravethari excel in roles requiring brute strength, stability under pressure, and resistance to environmental hazards.\n\nCULTURAL NOTES — Gravethari culture is stoic and communal, shaped by generations of surviving tectonic collapses. Their rituals emphasize endurance and collective resilience. Gravethari architecture favors low, reinforced structures designed to withstand seismic activity.",
    accent: "#F97316",
    icon: "weight",
    order: 6,
  },
  {
    name: "Silthari",
    slug: "silthari",
    category: "species",
    description:
      "Homeworld: Silthar. Environment: High pressure abyssal ocean trenches. Primary Ability: Amphibious pressure control.\n\nPHYSIOLOGY — Silthari possess dual mode respiratory systems: surface lungs for air and micro gill membranes for dissolved oxygen extraction. Their bodies contain pressure equalizing organs that compress or expand to stabilize internal force, preventing tissue collapse at depths exceeding 900 bar. Their musculature is hydrodynamic, with layered fibers that reduce drag and allow rapid acceleration underwater. Silthari eyes are adapted for low light visibility, and their skin secretes a pressure stabilizing gel that protects against micro abrasions.\n\nENVIRONMENTAL ADAPTATION — Silthari evolved in abyssal zones where sudden pressure shifts from tectonic water collapses were common. Their ability to regulate internal pressure allowed them to survive extreme depth changes and navigate underwater fissures. Hydrodynamic bodies enabled them to evade predators and hunt efficiently in low visibility environments.\n\nMIGRATION PATTERN — Silthari thrive in aquatic colonies, hydro mining stations, and mixed environment habitats. Their adaptability makes them valuable in underwater construction, oceanic research, and amphibious operations. They integrate well into multispecies societies but often prefer environments with water access.\n\nSTAR FORCE SUITABILITY — EVA divers, aquatic special operations, hazard environment teams, infiltration specialists. Their pressure control and hydrodynamic movement give them advantages in underwater combat and zero gravity environments.\n\nCULTURAL NOTES — Silthari culture values fluidity, calm, and adaptability. Their rituals mimic tidal rhythms, and their art often incorporates flowing patterns inspired by ocean currents. Silthari music emphasizes resonance and harmonic vibration, reflecting their underwater origins.",
    accent: "#0EA5E9",
    icon: "droplets",
    order: 7,
  },
  {
    name: "Myr-Kael",
    slug: "myr-kael",
    category: "species",
    description:
      "Homeworld: Kael Myr. Environment: Dense fungal forest world with swarm predators. Primary Ability: Swarm coordination (quantum linked biology).\n\nPHYSIOLOGY — Myr Kael possess neural link organ clusters that emit low frequency EM pulses, synchronizing movement and decision making among nearby Myr Kael. Their brains support distributed cognition, allowing them to operate as coordinated units without verbal communication. Their limbs are optimized for rapid movement through dense fungal terrain, with flexible joints and lightweight musculature that support agile group maneuvers.\n\nENVIRONMENTAL ADAPTATION — Myr Kael evolved to counter swarm predators by forming coordinated defensive groups. Their ability to synchronize movement allowed them to overwhelm threats and navigate complex environments. Quantum linked neural clusters enabled instantaneous communication across short distances, giving them a collective advantage in survival and hunting.\n\nMIGRATION PATTERN — Myr Kael are found in cooperative labor colonies, tactical units, and swarm optimized industrial operations. Their distributed cognition makes them ideal for tasks requiring synchronized effort, such as construction, manufacturing, and coordinated defense.\n\nSTAR FORCE SUITABILITY — Squad coordination, synchronized operations, tactical formations, cooperative engineering. Myr Kael excel in roles where group cohesion and rapid collective response are essential.\n\nCULTURAL NOTES — Highly collective; decisions often made through group consensus. Their art is collaborative and multi layered, with performances involving synchronized movement and harmonic vocalization. Myr Kael social structures emphasize unity and shared purpose.",
    accent: "#E879F9",
    icon: "users",
    order: 8,
  },
  {
    name: "Theritechs",
    slug: "theritechs",
    category: "species",
    description:
      "Homeworld: Therit. Environment: Magnetar influenced world with intense EM storms. Primary Ability: Electromagnetic sensing.\n\nPHYSIOLOGY — Theritechs possess conductive dermal filaments and EM sensitive nerve clusters that detect ion fields, electrical currents, and magnetic fluctuations. Their nervous system is shielded against EM interference by conductive tissue layers. Their eyes can detect EM spectrum shifts invisible to most species. Theritechs' reflexes are tuned to respond to sudden EM changes, allowing them to navigate hazardous environments with precision.\n\nENVIRONMENTAL ADAPTATION — Theritechs' magnetar influence created constant EM storms that shaped predator movement and environmental hazards. Theritechs evolved to sense EM fields, enabling them to detect threats early and avoid lethal ion surges. Their ability to interpret magnetic fluctuations allowed them to navigate terrain that shifted unpredictably under electromagnetic stress.\n\nMIGRATION PATTERN — Theritechs are common in sensor arrays, reactor facilities, and EM hazard zones. Their abilities make them valuable in electronic warfare, engineering, and scientific research. They integrate well into multispecies societies but often gravitate toward technical roles.\n\nSTAR FORCE SUITABILITY — Electronic warfare, sensor operations, engineering, EM hazard teams. Their EM sensitivity gives them advantages in detecting cloaked units and navigating electronic battlefields.\n\nCULTURAL NOTES — Theritechs' culture values precision, clarity, and analytical thinking. Their communication often incorporates EM based signaling, and their art emphasizes patterns inspired by magnetic fields and ion flows.",
    accent: "#E6A817",
    icon: "waves",
    order: 9,
  },
  {
    name: "Auralith",
    slug: "auralith",
    category: "species",
    description:
      "Homeworld: Auralis. Environment: Resonant cavern world with harmonic wind tunnels. Primary Ability: Resonance communication.\n\nPHYSIOLOGY — Auralith possess resonance chambers in their chest and throat that generate harmonic frequencies for communication. Their hearing is tuned to detect micro vibrations and structural resonance. Their bones contain flexible mineral fibers that amplify harmonic waves. Auralith vocalizations can map terrain, coordinate movement, or convey emotional states through complex harmonic patterns.\n\nENVIRONMENTAL ADAPTATION — Auralis’s cavern systems relied on sound for navigation. Harmonic wind tunnels created shifting acoustic landscapes that required precise resonance detection. Auralith evolved to use sound as both a sensory tool and a communication method, allowing them to coordinate movement in environments where visual cues were unreliable.\n\nMIGRATION PATTERN — Auralith are found in communication hubs, acoustic engineering roles, and sensor arrays. Their resonance abilities make them valuable in signal operations and structural analysis. They integrate well into multispecies societies due to their cooperative communication style.\n\nSTAR FORCE SUITABILITY — Signal operations, recon, acoustic mapping, communication specialists. Their harmonic abilities allow them to detect structural weaknesses and navigate complex environments.\n\nCULTURAL NOTES — Highly musical; communication blends speech and harmonic tones. Rituals involve group resonance performances that symbolize unity and shared identity. Auralith architecture incorporates resonant stone that amplifies communal harmonic events.",
    accent: "#34D399",
    icon: "gem",
    order: 10,
  },
  {
    name: "Umbraxi",
    slug: "umbraxi",
    category: "species",
    description:
      "Homeworld: Umbrax. Environment: Low light world with dense shadow forests. Primary Ability: Stealth adaptation.\n\nPHYSIOLOGY — Umbraxi possess dermal chromatophores that absorb and diffuse light, allowing them to blend into shadows. Their movement is nearly silent due to soft tissue footpads and vibration dampening joints. Their eyes are optimized for low light vision, with retinas capable of amplifying minimal ambient light. Umbraxi musculature supports slow, controlled movement that minimizes detectable motion.\n\nENVIRONMENTAL ADAPTATION — Umbrax’s shadow forests created environments where light was scarce and predators relied on motion detection. Umbraxi evolved to absorb light and minimize movement signatures, allowing them to evade predators and hunt effectively. Their stealth abilities became central to their survival and social development.\n\nMIGRATION PATTERN — Umbraxi are common in stealth colonies, infiltration units, and covert operations. Their abilities make them valuable in espionage, reconnaissance, and night ops missions. They integrate well into multispecies societies but often prefer dimly lit environments.\n\nSTAR FORCE SUITABILITY — Infiltration, reconnaissance, covert operations, stealth scouts. Umbraxi excel in missions requiring silence, concealment, and precision.\n\nCULTURAL NOTES — Umbraxi culture values subtlety, quiet communication, and precision. Their art often uses shadow and negative space, and their rituals emphasize controlled movement and minimal sound.",
    accent: "#8B5CF6",
    icon: "eclipse",
    order: 11,
  },
  {
    name: "Nythori",
    slug: "nythori",
    category: "species",
    description:
      "Homeworld: Nythor. Environment: Low gravity aerial world. Primary Ability: Aerial maneuvering.\n\nPHYSIOLOGY — Nythori possess lightweight skeletal structures, aerodynamic limbs, and air density sensing organs. Their musculature is optimized for gliding and rapid directional changes. Their lungs are adapted for thin air, allowing efficient oxygen extraction at high altitudes. Nythori eyes are tuned for long distance vision, enabling them to track movement across vast aerial landscapes.\n\nENVIRONMENTAL ADAPTATION — Nythor’s floating forest canopies required species capable of aerial navigation. Nythori evolved gliding membranes and aerodynamic bodies that allowed them to escape aerial predators and hunt efficiently. Their ability to sense air density changes enabled them to anticipate wind shifts and navigate complex aerial terrain.\n\nMIGRATION PATTERN — Nythori are widely used in piloting and navigation roles. Their aerial abilities make them valuable in EVA operations, starship maneuvering, and high altitude reconnaissance. They integrate well into multispecies societies but often prefer open environments.\n\nSTAR FORCE SUITABILITY — Pilots, EVA specialists, recon scouts, rapid deployment units. Their aerial maneuverability gives them advantages in zero gravity and high mobility missions.\n\nCULTURAL NOTES — Nythori culture values freedom, mobility, and spatial awareness. Rituals often involve synchronized aerial dances, and their art emphasizes fluid motion and open space.",
    accent: "#7DD3FC",
    icon: "wind",
    order: 12,
  },
  {
    name: "Orvaxian",
    slug: "orvaxian",
    category: "species",
    description:
      "Homeworld: Orvax Prime. Environment: Metallic super planet with constant seismic activity. Primary Ability: Armored durability.\n\nPHYSIOLOGY — Orvaxians grow metallic keratin plates across their bodies. These plates regenerate when damaged and can deflect shrapnel, heat, and low caliber projectiles. Their organs are suspended in shock absorbing gel layers that protect them during violent quakes. Orvaxian musculature is compact and dense, optimized for stability and impact resistance.\n\nENVIRONMENTAL ADAPTATION — Orvax Prime’s metallic plains and seismic quakes shaped Orvaxian survival. Constant tremors required bodies capable of absorbing shock and maintaining balance. Their armored plates evolved to protect against falling debris and metallic storms, giving them natural resilience in hazardous environments.\n\nMIGRATION PATTERN — Orvaxians are often employed in industrial security, hazardous construction, and asteroid mining. Their durability makes them ideal for environments with high physical risk. They integrate well into multispecies societies but often gravitate toward protective roles.\n\nSTAR FORCE SUITABILITY — Marines, breachers, riot control units, defensive infantry. Orvaxians excel in roles requiring physical resilience and frontline stability.\n\nCULTURAL NOTES — Orvaxian culture is honor based, with clan structures that emphasize endurance and strength. Disputes are often settled through controlled endurance trials. Their art incorporates metallic resonance patterns inspired by seismic vibrations.",
    accent: "#94A3B8",
    icon: "mountain",
    order: 13,
  },
  {
    name: "Vedan",
    slug: "vedan",
    category: "species",
    description:
      "Homeworld: Vedae. Environment: Radiation rich nebula world. Primary Ability: Radiation & EM embodiment.\n\nPHYSIOLOGY — Vedan bodies contain radiation absorbing organelles that convert high energy particles into metabolic fuel. Their skin is reinforced with EM diffusion layers that prevent cellular damage. Their blood carries radiation binding proteins that neutralize harmful particles. Vedan neural pathways include EM buffering structures that protect against ion surges.\n\nENVIRONMENTAL ADAPTATION — Vedae’s nebula regions exposed early Vedan organisms to constant radiation storms. Vedan evolved to absorb radiation rather than resist it, allowing them to thrive in environments that would sterilize most species. Their ability to convert radiation into energy gave them metabolic advantages in high EM environments.\n\nMIGRATION PATTERN — Vedan are common in reactor operations, radiation research, and EM hazard zones. Their abilities make them valuable in electronic warfare and energy field stabilization. They integrate well into multispecies societies but often prefer environments with high EM activity.\n\nSTAR FORCE SUITABILITY — Hazard ops, reactor teams, electronic warfare, energy field specialists. Vedan excel in roles requiring radiation tolerance and EM manipulation.\n\nCULTURAL NOTES — Vedan culture values endurance, transformation, and harmony with energetic environments. Rituals often involve controlled radiation displays, and their art incorporates glowing materials that respond to EM fields.",
    accent: "#FBBF24",
    icon: "sun",
    order: 14,
  },
  {
    name: "Lithovex",
    slug: "lithovex",
    category: "species",
    description:
      "Homeworld: Lithovar. Environment: Stone dense moon with low oxygen. Primary Ability: Living stone physiology.\n\nPHYSIOLOGY — Lithovex possess semi mineralized tissues and slow metabolism that allow survival with minimal oxygen. Their skin resembles polished stone and is nearly impervious to cuts. Their bones are reinforced with mineral composites that resist compression. Their respiratory system is optimized for low oxygen intake, allowing them to operate in subterranean environments for extended periods.\n\nENVIRONMENTAL ADAPTATION — Lithovar’s subterranean caverns required species capable of surviving low oxygen and high mineral content. Lithovex evolved mineralized tissues that provided durability and protection against abrasive terrain. Their slow metabolism allowed them to conserve energy in environments with limited resources.\n\nMIGRATION PATTERN — Lithovex are found in asteroid colonies, deep space mining operations, and subterranean research stations. Their durability and low oxygen tolerance make them ideal for environments where other species cannot operate safely.\n\nSTAR FORCE SUITABILITY — Marines, boarding teams, defensive units, shock infantry. Lithovex excel in roles requiring endurance, stability, and resistance to physical harm.\n\nCULTURAL NOTES — Lithovex culture is patient, contemplative, and focused on long term thinking. Their architecture is carved directly from stone, and their rituals emphasize endurance and stability. Lithovex art often incorporates mineral patterns and slow, deliberate craftsmanship.",
    accent: "#A3E635",
    icon: "box",
    order: 15,
  },

  // ---- Section II — Species 16–20 ----------------------------------------
  {
    name: "Varuun",
    slug: "varuun",
    category: "species",
    description:
      "Homeworld: Varuun Prime. Environment: Dense basalt canyons with hyper compressed atmosphere. Primary Ability: Pressure adaptive musculature.\n\nPHYSIOLOGY — Varuun possess muscular systems engineered by evolution to withstand crushing atmospheric pressure. Their fibers are arranged in interlocking bands that tighten under compression, allowing them to maintain mobility even in environments exceeding 40 atmospheres. Their lungs contain reinforced alveolar sacs capable of extracting oxygen from dense, particulate heavy air. Varuun dermal layers are thick and rubberized, preventing micro tears during rapid pressure shifts. A secondary pressure modulation organ prevents blood vessel rupture when transitioning between high pressure and standard pressure environments.\n\nENVIRONMENTAL ADAPTATION — Varuun Prime’s atmosphere is dense enough to crush most species. Early Varuun evolved compact frames and pressure responsive musculature to survive sudden atmospheric spikes caused by canyon collapses and volcanic gas surges. Their ability to withstand extreme compression allowed them to navigate deep canyons where mineral deposits formed. Pressure adaptation became central to Varuun identity, shaping their physiology, architecture, and social rituals.\n\nMIGRATION PATTERN — Varuun are common in deep sea colonies, high pressure industrial zones, and atmospheric research stations. Their physiology makes them ideal for environments where pressure fluctuations are constant. They integrate well into multispecies societies but often gravitate toward roles requiring physical resilience.\n\nSTAR FORCE SUITABILITY — Hazard environment infantry, deep pressure engineering units, boarding teams, and atmospheric stabilization squads. Varuun excel in missions requiring endurance under crushing force.\n\nCULTURAL NOTES — Varuun culture values stability, endurance, and controlled strength. Rituals often involve pressure resistance trials where participants demonstrate calmness under increasing atmospheric load. Their art emphasizes solidity and weight, often carved from dense basalt blocks.",
    accent: "#F97316",
    icon: "shield",
    order: 16,
  },
  {
    name: "Kelari",
    slug: "kelari",
    category: "species",
    description:
      "Homeworld: Kelar. Environment: Bioluminescent wetlands with shifting microbial mats. Primary Ability: Bio reactive skin signaling.\n\nPHYSIOLOGY — Kelari possess dermal layers embedded with bio reactive chromatophores that respond to chemical cues in the environment. Their skin can shift color, pattern, and luminosity based on emotional state, environmental conditions, or intentional signaling. Kelari neural pathways include chemical sensing nodes that detect microbial activity, allowing them to interpret subtle changes in wetland ecosystems. Their musculature is flexible and optimized for movement through soft, unstable terrain.\n\nENVIRONMENTAL ADAPTATION — Kelar’s wetlands are dominated by bioluminescent microbial mats that shift unpredictably. Kelari evolved skin capable of reacting to chemical changes, allowing them to blend into glowing terrain or communicate through patterned light. Their ability to interpret microbial signals gave them early warning of predators and environmental hazards. Bio reactive signaling became central to Kelari communication and social structure.\n\nMIGRATION PATTERN — Kelari thrive in ecological research stations, xenobotanical colonies, and environments requiring chemical analysis. Their ability to interpret microbial ecosystems makes them valuable in terraforming and environmental monitoring.\n\nSTAR FORCE SUITABILITY — Reconnaissance, environmental analysis, stealth operations, and xenobiology support. Their bio reactive skin allows silent communication and adaptive camouflage.\n\nCULTURAL NOTES — Kelari culture is expressive and visually oriented. Social rituals involve synchronized luminescent displays that convey emotional states or communal narratives. Their art incorporates glowing pigments and shifting patterns inspired by wetland bioluminescence.",
    accent: "#E879F9",
    icon: "feather",
    order: 17,
  },
  {
    name: "Shendral",
    slug: "shendral",
    category: "species",
    description:
      "Homeworld: Shendralis. Environment: High wind plateau world with constant atmospheric shear. Primary Ability: Aerodynamic skeletal architecture.\n\nPHYSIOLOGY — Shendral possess lightweight skeletal structures reinforced with flexible mineral fibers that bend under wind pressure without breaking. Their limbs are elongated and aerodynamic, allowing them to glide short distances or stabilize themselves during violent gusts. Shendral lungs are adapted for thin air, with expanded alveolar networks that maximize oxygen extraction. Their dermal layers include micro grooved surfaces that reduce drag and prevent windburn.\n\nENVIRONMENTAL ADAPTATION — Shendralis is defined by constant atmospheric shear, with winds strong enough to lift or topple early organisms. Shendral evolved aerodynamic bodies capable of redirecting wind force rather than resisting it. Their ability to glide between plateau ridges allowed them to escape predators and traverse vast distances. Wind navigation became central to Shendral culture and identity.\n\nMIGRATION PATTERN — Shendral are common in high altitude colonies, EVA operations, and starship exterior maintenance roles. Their aerodynamic physiology makes them ideal for environments with low gravity or thin atmosphere.\n\nSTAR FORCE SUITABILITY — Piloting, EVA maneuvering, high altitude reconnaissance, and rapid deployment units. Shendral excel in roles requiring agility and environmental awareness.\n\nCULTURAL NOTES — Shendral culture values freedom, movement, and harmony with atmospheric flow. Rituals often involve wind dances performed on plateau edges, and their architecture incorporates open structures designed to channel wind through communal spaces.",
    accent: "#7DD3FC",
    icon: "wind",
    order: 18,
  },
  {
    name: "Thalorim",
    slug: "thalorim",
    category: "species",
    description:
      "Homeworld: Thalor. Environment: Subterranean magma tube networks. Primary Ability: Thermal resonance mapping.\n\nPHYSIOLOGY — Thalorim possess specialized sensory organs capable of detecting thermal gradients with extreme precision. Their bodies include heat resistant dermal layers and internal cooling channels that regulate temperature during magma tube traversal. Thalorim neural pathways are tuned to interpret thermal resonance patterns, allowing them to map subterranean structures through heat signatures alone. Their musculature is compact and optimized for movement through narrow tunnels.\n\nENVIRONMENTAL ADAPTATION — Thalor’s subterranean magma tube networks required species capable of navigating environments where visual cues were minimal and heat levels fluctuated rapidly. Thalorim evolved thermal resonance mapping to detect structural weaknesses, magma flows, and predator movement. Their ability to interpret heat signatures allowed them to survive in environments where most species would be incinerated or lost.\n\nMIGRATION PATTERN — Thalorim are common in geothermal engineering, subterranean research, and hazard environment exploration. Their thermal mapping abilities make them valuable in structural analysis and underground navigation.\n\nSTAR FORCE SUITABILITY — Hazard ops, subterranean infiltration, structural reconnaissance, and thermal environment specialists.\n\nCULTURAL NOTES — Thalorim culture emphasizes patience, precision, and awareness of unseen forces. Rituals involve communal heat mapping ceremonies where participants interpret thermal patterns as symbolic narratives. Their art incorporates flowing shapes inspired by magma movement.",
    accent: "#F77F2A",
    icon: "flame",
    order: 19,
  },
  {
    name: "Arvex",
    slug: "arvex",
    category: "species",
    description:
      "Homeworld: Arvexia. Environment: Crystal reef archipelagos with refractive light fields. Primary Ability: Refractive vision and light phase perception.\n\nPHYSIOLOGY — Arvex possess multi layered crystalline lenses in their eyes that refract light into multiple spectral bands. This allows them to perceive refractive distortions, polarized light, and phase shifted wavelengths invisible to most species. Their dermal layers include reflective micro crystals that protect against intense glare. Arvex neural pathways are optimized for processing complex visual data, giving them exceptional spatial awareness and pattern recognition.\n\nENVIRONMENTAL ADAPTATION — Arvexia’s crystal reef archipelagos create refractive light fields that distort perception. Arvex evolved refractive vision to navigate environments where light bends unpredictably. Their ability to interpret phase shifted wavelengths allowed them to detect predators hiding behind refractive barriers and locate safe paths through crystal reefs.\n\nMIGRATION PATTERN — Arvex are common in sensor operations, navigation roles, and optical research. Their refractive perception makes them valuable in environments with complex visual distortion, such as nebulae or crystalline asteroid fields.\n\nSTAR FORCE SUITABILITY — Reconnaissance, sensor calibration, optical analysis, and navigation. Arvex excel in roles requiring precise visual interpretation.\n\nCULTURAL NOTES — Arvex culture values clarity, perception, and the beauty of refracted light. Rituals involve light phase ceremonies where participants create refractive patterns using crystal instruments. Their art emphasizes symmetry, spectral color, and optical illusion.",
    accent: "#34D399",
    icon: "gem",
    order: 20,
  },

  // ---- Section III — Species 21–30 ---------------------------------------
  {
    name: "Solari",
    slug: "solari",
    category: "species",
    description:
      "Homeworld: Solyss. Environment: High luminosity desert world with intense solar flux. Primary Ability: Photothermal conversion.\n\nPHYSIOLOGY — Solari possess dermal layers embedded with photoreceptive organelles capable of converting solar radiation directly into metabolic energy. Their skin shifts in hue depending on solar intensity, darkening to protect against ultraviolet overload and lightening to maximize absorption during low light periods. Solari musculature is supported by heat resistant proteins that maintain structural integrity even under extreme thermal exposure. Their cardiovascular system includes cooling channels that circulate thermally regulated fluids to prevent overheating.\n\nENVIRONMENTAL ADAPTATION — Solyss’s deserts experience solar flux levels that would desiccate most species. Early Solari evolved photothermal conversion to survive prolonged exposure without relying on scarce food sources. Their ability to metabolize sunlight allowed them to remain active during heat spikes and conserve energy during sandstorms. Over time, solar absorption became central to Solari identity, influencing their architecture, clothing, and ritual practices.\n\nMIGRATION PATTERN — Solari thrive in high radiation environments, solar research stations, and energy harvesting colonies. Their physiology makes them ideal for roles requiring endurance in bright, hot conditions. They integrate well into multispecies societies but often prefer open, sunlit environments.\n\nSTAR FORCE SUITABILITY — Hazard ops, solar array engineering, desert reconnaissance, and energy field stabilization. Solari excel in missions requiring heat tolerance and sustained endurance.\n\nCULTURAL NOTES — Solari culture values illumination, clarity, and personal radiance. Rituals often involve communal sun bathing ceremonies where participants synchronize photothermal absorption. Their art emphasizes light, shadow, and reflective surfaces that mimic solar patterns.",
    accent: "#FBBF24",
    icon: "sun",
    order: 21,
  },
  {
    name: "Dravari",
    slug: "dravari",
    category: "species",
    description:
      "Homeworld: Dravaros. Environment: Metallic storm plains with ferrous lightning. Primary Ability: Conductive bio current channeling.\n\nPHYSIOLOGY — Dravari possess conductive dermal pathways that allow electrical currents to travel safely across their bodies. Their skeletal structure includes ferrous micro filaments that act as grounding rods, preventing internal damage during lightning strikes. Dravari neural systems are shielded by insulating sheaths that protect against electrical overload. Their musculature is reinforced with ion stabilizing proteins that maintain function even under high current exposure.\n\nENVIRONMENTAL ADAPTATION — Dravaros’s metallic plains generate ferrous lightning storms that strike unpredictably. Early Dravari evolved conductive pathways to channel lightning harmlessly through their bodies. This adaptation allowed them to survive in regions where electrical storms shaped predator movement and environmental hazards. Over time, bio current channeling became a tool for communication, intimidation, and ritual performance.\n\nMIGRATION PATTERN — Dravari are common in reactor facilities, electrical engineering colonies, and EM hazard zones. Their conductive physiology makes them valuable in high voltage environments and electronic warfare operations.\n\nSTAR FORCE SUITABILITY — Electronic warfare, reactor maintenance, hazard ops, and storm zone reconnaissance. Dravari excel in missions requiring electrical resilience.\n\nCULTURAL NOTES — Dravari culture values intensity, precision, and controlled power. Rituals often involve lightning channeling ceremonies where participants direct electrical arcs into patterned displays. Their art incorporates metallic materials that resonate with electrical currents.",
    accent: "#E6A817",
    icon: "zap",
    order: 22,
  },
  {
    name: "Lyrathi",
    slug: "lyrathi",
    category: "species",
    description:
      "Homeworld: Lyraen. Environment: Floating archipelagos with atmospheric micro currents. Primary Ability: Micro current aerokinesis.\n\nPHYSIOLOGY — Lyrathi possess sensory organs capable of detecting micro currents in the atmosphere. Their limbs include aerodynamic membranes that allow them to manipulate small airflows for balance, movement, or communication. Lyrathi neural pathways are tuned to interpret subtle shifts in air density, giving them exceptional spatial awareness. Their respiratory system is optimized for thin air, allowing efficient oxygen extraction at high altitudes.\n\nENVIRONMENTAL ADAPTATION — Lyraen’s floating archipelagos drift through atmospheric layers where micro currents dictate movement. Lyrathi evolved aerokinetic sensitivity to navigate these shifting environments. Their ability to manipulate small airflows allowed them to stabilize themselves during sudden drops or gusts. Over time, micro current control became a form of expression and communication.\n\nMIGRATION PATTERN — Lyrathi thrive in high altitude colonies, EVA operations, and starship maneuvering roles. Their aerokinetic abilities make them valuable in environments requiring precise movement and atmospheric awareness.\n\nSTAR FORCE SUITABILITY — Piloting, EVA maneuvering, aerial reconnaissance, and rapid deployment units. Lyrathi excel in roles requiring agility and environmental sensitivity.\n\nCULTURAL NOTES — Lyrathi culture values grace, fluidity, and harmony with atmospheric flow. Rituals involve aerial dances performed on floating platforms, and their art emphasizes movement and open space.",
    accent: "#7DD3FC",
    icon: "feather",
    order: 23,
  },
  {
    name: "Vornak",
    slug: "vornak",
    category: "species",
    description:
      "Homeworld: Vornakos. Environment: Subzero tundra with crystalline ice storms. Primary Ability: Cryogenic metabolic regulation.\n\nPHYSIOLOGY — Vornak possess metabolic pathways capable of functioning at temperatures far below freezing. Their blood contains antifreeze proteins that prevent ice crystal formation. Vornak dermal layers include insulating fat deposits and crystalline fibers that reflect cold radiation. Their musculature remains flexible even in subzero conditions due to cryo resistant myofibrils. Vornak neural systems operate at low temperatures without slowing, supported by ion stabilizing neurotransmitters.\n\nENVIRONMENTAL ADAPTATION — Vornakos’s tundra experiences crystalline ice storms that can flash freeze exposed organisms. Early Vornak evolved cryogenic regulation to survive prolonged exposure. Their ability to maintain metabolic function in extreme cold allowed them to hunt, build, and travel during conditions that immobilized other species. Over time, cold endurance became central to Vornak identity.\n\nMIGRATION PATTERN — Vornak are common in polar colonies, cryogenic research stations, and deep space environments where temperature control is critical. They integrate well into multispecies societies but often prefer cold climates.\n\nSTAR FORCE SUITABILITY — Hazard ops, cryogenic engineering, polar reconnaissance, and deep space survival. Vornak excel in missions requiring cold endurance.\n\nCULTURAL NOTES — Vornak culture values resilience, stillness, and clarity. Rituals involve ice carving ceremonies where participants shape crystalline structures that refract light. Their art emphasizes symmetry, cold hues, and frozen landscapes.",
    accent: "#818CF8",
    icon: "moon",
    order: 24,
  },
  {
    name: "Seraphi",
    slug: "seraphi",
    category: "species",
    description:
      "Homeworld: Seraphis. Environment: High altitude cloud forests with ionized mist. Primary Ability: Ion mist respiration.\n\nPHYSIOLOGY — Seraphi possess dual respiratory systems capable of extracting oxygen from ionized mist. Their lungs include electrostatic membranes that separate charged particles from breathable air. Seraphi dermal layers are soft and moisture absorbent, allowing them to retain hydration in thin, misty environments. Their musculature is lightweight and optimized for movement through dense cloud forests.\n\nENVIRONMENTAL ADAPTATION — Seraphis’s cloud forests are saturated with ionized mist that interferes with conventional respiration. Seraphi evolved electrostatic membranes to filter charged particles and extract oxygen efficiently. Their ability to breathe ionized air allowed them to inhabit high altitude regions inaccessible to other species. Over time, mist navigation became central to Seraphi culture.\n\nMIGRATION PATTERN — Seraphi thrive in high altitude colonies, atmospheric research stations, and environments requiring moisture regulation. Their physiology makes them valuable in roles requiring endurance in thin, ionized air.\n\nSTAR FORCE SUITABILITY — Reconnaissance, atmospheric analysis, EVA operations, and environmental monitoring. Seraphi excel in missions requiring adaptability to thin or ionized atmospheres.\n\nCULTURAL NOTES — Seraphi culture values serenity, elevation, and harmony with atmospheric moisture. Rituals involve mist weaving ceremonies where participants shape ionized vapor into symbolic forms. Their art emphasizes translucence, softness, and flowing patterns.",
    accent: "#38BDF8",
    icon: "waves",
    order: 25,
  },
  {
    name: "Korvathi",
    slug: "korvathi",
    category: "species",
    description:
      "Homeworld: Korvath. Environment: Dense fungal caverns with biotoxic spores. Primary Ability: Spore neutralizing biochemistry.\n\nPHYSIOLOGY — Korvathi possess biochemical pathways capable of neutralizing toxic spores. Their respiratory system includes filtration membranes that trap and dissolve harmful particulates. Korvathi dermal layers secrete enzymes that break down biotoxins on contact. Their musculature is compact and optimized for movement through tight cavern spaces. Korvathi neural pathways include toxin resistant sheaths that protect against neurotoxic spores.\n\nENVIRONMENTAL ADAPTATION — Korvath’s fungal caverns produce biotoxic spores that incapacitate most species. Early Korvathi evolved spore neutralizing biochemistry to survive prolonged exposure. Their ability to dissolve toxins allowed them to navigate deep caverns and harvest fungal resources. Over time, toxin resistance became central to Korvathi identity.\n\nMIGRATION PATTERN — Korvathi are common in xenobiology labs, hazardous environment colonies, and spore rich ecosystems. Their abilities make them valuable in roles requiring toxin management and biological analysis.\n\nSTAR FORCE SUITABILITY — Hazard ops, biological containment, infiltration, and environmental stabilization. Korvathi excel in missions requiring toxin resistance.\n\nCULTURAL NOTES — Korvathi culture values caution, precision, and respect for biological complexity. Rituals involve spore mapping ceremonies where participants interpret fungal growth patterns. Their art incorporates organic shapes inspired by cavern ecosystems.",
    accent: "#4ADE80",
    icon: "shield",
    order: 26,
  },
  {
    name: "Talrien",
    slug: "talrien",
    category: "species",
    description:
      "Homeworld: Talrios. Environment: High gravity ocean world with crushing tidal forces. Primary Ability: Hydrodynamic gravitic endurance.\n\nPHYSIOLOGY — Talrien possess dense musculature and reinforced skeletal structures capable of withstanding extreme gravitational pressure. Their bodies are hydrodynamic, allowing efficient movement through high density water. Talrien lungs include pressure resistant alveoli that prevent collapse during deep dives. Their cardiovascular system is optimized for circulation under crushing force.\n\nENVIRONMENTAL ADAPTATION — Talrios’s oceans experience tidal forces strong enough to crush most species. Early Talrien evolved gravitic endurance to survive deep water pressure and rapid tidal shifts. Their hydrodynamic bodies allowed them to navigate underwater terrain and evade predators. Over time, gravitic adaptation became central to Talrien identity.\n\nMIGRATION PATTERN — Talrien thrive in aquatic colonies, deep sea research stations, and high gravity environments. Their physiology makes them valuable in roles requiring endurance under pressure.\n\nSTAR FORCE SUITABILITY — Aquatic ops, hazard environment engineering, EVA operations, and boarding missions. Talrien excel in roles requiring strength and pressure tolerance.\n\nCULTURAL NOTES — Talrien culture values depth, endurance, and fluid motion. Rituals involve deep water gatherings where participants synchronize movement with tidal rhythms. Their art emphasizes flowing shapes and oceanic themes.",
    accent: "#0EA5E9",
    icon: "droplets",
    order: 27,
  },
  {
    name: "Rhyvani",
    slug: "rhyvani",
    category: "species",
    description:
      "Homeworld: Rhyvan. Environment: Volatile geothermal plains with shifting lava vents. Primary Ability: Geothermal heat cycling.\n\nPHYSIOLOGY — Rhyvani possess internal heat cycling organs that regulate body temperature during exposure to geothermal surges. Their dermal layers include heat resistant scales that protect against radiant energy. Rhyvani musculature is reinforced with thermal stabilizing proteins that maintain function during extreme heat. Their neural pathways include heat buffering sheaths that prevent thermal overload.\n\nENVIRONMENTAL ADAPTATION — Rhyvan’s geothermal plains produce sudden lava vent eruptions that reshape terrain. Early Rhyvani evolved heat cycling organs to survive rapid temperature changes. Their ability to regulate internal heat allowed them to traverse unstable terrain and avoid geothermal hazards. Over time, heat cycling became central to Rhyvani identity.\n\nMIGRATION PATTERN — Rhyvani are common in geothermal engineering, hazard environment colonies, and volcanic research stations. Their physiology makes them valuable in roles requiring heat tolerance.\n\nSTAR FORCE SUITABILITY — Hazard ops, breaching, engineering, and thermal environment specialists. Rhyvani excel in missions requiring rapid heat adaptation.\n\nCULTURAL NOTES — Rhyvani culture values resilience, transformation, and harmony with geothermal forces. Rituals involve heat cycling ceremonies where participants synchronize internal temperature shifts. Their art incorporates molten patterns and flowing shapes inspired by lava movement.",
    accent: "#F77F2A",
    icon: "flame",
    order: 28,
  },
  {
    name: "Sylorin",
    slug: "sylorin",
    category: "species",
    description:
      "Homeworld: Sylora. Environment: Dense arboreal world with photosynthetic canopy networks. Primary Ability: Photosynthetic metabolic augmentation.\n\nPHYSIOLOGY — Sylorin possess dermal layers embedded with photosynthetic organelles that supplement metabolic energy. Their skin shifts in hue depending on light exposure, brightening during photosynthesis and darkening during rest. Sylorin musculature is lightweight and optimized for movement through dense canopy networks. Their neural pathways include light responsive nodes that enhance alertness during daylight.\n\nENVIRONMENTAL ADAPTATION — Sylora’s arboreal ecosystems rely on dense canopy networks that filter sunlight. Early Sylorin evolved photosynthetic augmentation to survive periods of limited food availability. Their ability to metabolize light allowed them to remain active during long treks through forest terrain. Over time, photosynthesis became central to Sylorin identity.\n\nMIGRATION PATTERN — Sylorin thrive in ecological colonies, botanical research stations, and environments requiring environmental harmony. Their physiology makes them valuable in roles requiring endurance and adaptability.\n\nSTAR FORCE SUITABILITY — Reconnaissance, environmental analysis, stealth operations, and long range scouting. Sylorin excel in missions requiring sustained endurance.\n\nCULTURAL NOTES — Sylorin culture values growth, harmony, and connection to natural cycles. Rituals involve sun gathering ceremonies where participants synchronize photosynthetic activity. Their art emphasizes organic shapes and vibrant colors.",
    accent: "#4ADE80",
    icon: "sun",
    order: 29,
  },
  {
    name: "Vaskari",
    slug: "vaskari",
    category: "species",
    description:
      "Homeworld: Vaskar. Environment: Metallic caverns with resonant echo chambers. Primary Ability: Echo mapping and acoustic navigation.\n\nPHYSIOLOGY — Vaskari possess resonance organs capable of producing controlled acoustic pulses. Their hearing is tuned to detect micro echoes and structural vibrations. Vaskari neural pathways interpret acoustic reflections to map terrain, detect movement, and identify structural weaknesses. Their musculature is compact and optimized for movement through narrow metallic caverns.\n\nENVIRONMENTAL ADAPTATION — Vaskar’s metallic caverns create complex echo chambers where sound is the primary means of navigation. Early Vaskari evolved echo mapping to detect predators, locate resources, and coordinate movement. Their ability to interpret acoustic reflections allowed them to thrive in environments where visual cues were unreliable.\n\nMIGRATION PATTERN — Vaskari are common in acoustic engineering, structural analysis, and subterranean colonies. Their abilities make them valuable in roles requiring precise environmental interpretation.\n\nSTAR FORCE SUITABILITY — Reconnaissance, signal operations, structural mapping, and infiltration. Vaskari excel in missions requiring acoustic awareness.\n\nCULTURAL NOTES — Vaskari culture is deeply musical, with rituals involving harmonic echo performances. Their art incorporates resonant metal structures that produce shifting tones when struck or touched.",
    accent: "#94A3B8",
    icon: "waves",
    order: 30,
  },

  // ---- Section IV — Species 36–50 ----------------------------------------
  {
    name: "Zevran",
    slug: "zevran",
    category: "species",
    description:
      "Homeworld: Zevra. Environment: High velocity river canyons with turbulent hydrodynamic flows. Primary Ability: Hydrokinesis through micro current limb modulation.\n\nPHYSIOLOGY — Zevran possess limb structures lined with micro current modulating membranes that allow them to redirect water flow around their bodies. Their musculature is optimized for rapid aquatic acceleration, with fiber bundles that contract in wave like patterns to generate thrust. Zevran skin is smooth and hydrophobic, reducing drag and allowing them to slip through turbulent currents without losing stability. Their cardiovascular system includes dual chamber hearts that maintain circulation even during sudden pressure changes.\n\nENVIRONMENTAL ADAPTATION — Zevra’s river canyons produce unpredictable hydrodynamic surges capable of sweeping organisms away. Early Zevran evolved micro current modulation to stabilize themselves in chaotic water. Their ability to redirect flow allowed them to hunt, evade predators, and navigate river systems that shifted daily. Over time, hydrokinesis became central to Zevran identity, shaping their movement, communication, and architecture.\n\nMIGRATION PATTERN — Zevran thrive in aquatic colonies, hydro engineering stations, and environments requiring fluid dynamic expertise. Their physiology makes them valuable in underwater construction and rapid aquatic transport.\n\nSTAR FORCE SUITABILITY — Aquatic ops, infiltration, hazard environment engineering, and EVA fluid navigation roles.\n\nCULTURAL NOTES — Zevran culture values fluidity, adaptability, and harmony with water. Rituals involve synchronized current dances performed in river chambers. Their art emphasizes flowing shapes and dynamic motion.",
    accent: "#38BDF8",
    icon: "droplets",
    order: 36,
  },
  {
    name: "Pyrrhian",
    slug: "pyrrhian",
    category: "species",
    description:
      "Homeworld: Pyrrhos. Environment: Ember plains with constant smoldering thermal vents. Primary Ability: Ember state metabolic ignition.\n\nPHYSIOLOGY — Pyrrhians possess internal ignition nodes that allow them to enter an “ember state,” where their bodies glow with low temperature combustion. Their skin is reinforced with heat resistant carbon silicate layers that prevent burns. Pyrrhian musculature is supported by combustion driven ATP pathways that increase strength and speed during ignition. Their respiratory system filters smoke and particulate matter, allowing them to breathe in smoldering environments.\n\nENVIRONMENTAL ADAPTATION — Pyrrhos’s ember plains are filled with smoldering vents that release toxic fumes and sudden heat bursts. Early Pyrrhians evolved ember ignition to regulate internal temperature and deter predators. Their ability to glow in low light environments became a communication tool and a method for navigating smoke filled terrain.\n\nMIGRATION PATTERN — Pyrrhians are common in fire suppression units, volcanic colonies, and industrial smelting operations. Their physiology makes them ideal for environments requiring heat tolerance and smoke filtration.\n\nSTAR FORCE SUITABILITY — Hazard ops, breaching, fire control, and thermal environment combat.\n\nCULTURAL NOTES — Pyrrhian culture values intensity, transformation, and controlled flame. Rituals involve ember state gatherings where participants synchronize internal ignition patterns. Their art incorporates glowing pigments and charred textures.",
    accent: "#EF4444",
    icon: "flame",
    order: 37,
  },
  {
    name: "Quorathi",
    slug: "quorathi",
    category: "species",
    description:
      "Homeworld: Quorath. Environment: Dense crystal caverns with resonant energy fields. Primary Ability: Resonant energy harmonization.\n\nPHYSIOLOGY — Quorathi possess crystalline organ structures that vibrate in response to ambient energy fields. Their bodies can harmonize with resonant frequencies, allowing them to stabilize or disrupt energy patterns. Quorathi dermal layers include micro crystals that refract light and energy. Their neural pathways are tuned to interpret harmonic vibrations, giving them exceptional sensitivity to environmental resonance.\n\nENVIRONMENTAL ADAPTATION — Quorath’s crystal caverns amplify energy fields that can disorient or incapacitate most species. Early Quorathi evolved harmonic organs to stabilize themselves and navigate resonant terrain. Their ability to harmonize with energy fields allowed them to detect predators, locate resources, and coordinate movement.\n\nMIGRATION PATTERN — Quorathi thrive in energy research stations, sensor arrays, and environments requiring harmonic stabilization. Their abilities make them valuable in electronic warfare and energy field engineering.\n\nSTAR FORCE SUITABILITY — Signal operations, electronic warfare, energy field stabilization, and reconnaissance.\n\nCULTURAL NOTES — Quorathi culture is deeply musical, with rituals involving harmonic resonance performances. Their art incorporates crystalline structures that produce shifting tones when struck or illuminated.",
    accent: "#34D399",
    icon: "gem",
    order: 38,
  },
  {
    name: "Threxian",
    slug: "threxian",
    category: "species",
    description:
      "Homeworld: Threx. Environment: Metallic desert world with abrasive ion storms. Primary Ability: Ion abrasion dermal shielding.\n\nPHYSIOLOGY — Threxians possess dermal layers composed of metallic micro plates that resist abrasion from ion storms. Their skin can harden temporarily during exposure to high velocity particulates. Threxian musculature is dense and shock absorbent, allowing them to withstand sudden impacts. Their respiratory system includes ion filtration membranes that prevent lung damage during storms.\n\nENVIRONMENTAL ADAPTATION — Threx’s metallic deserts produce abrasive ion storms capable of stripping flesh. Early Threxians evolved dermal shielding to survive prolonged exposure. Their ability to harden skin allowed them to traverse storm zones and hunt in environments where other species could not survive.\n\nMIGRATION PATTERN — Threxians are common in industrial colonies, mining operations, and environments requiring abrasion resistance. They integrate well into multispecies societies but often prefer rugged terrain.\n\nSTAR FORCE SUITABILITY — Marines, breachers, hazard ops, and frontline infantry.\n\nCULTURAL NOTES — Threxian culture values toughness, endurance, and resilience. Rituals involve storm walking ceremonies where participants demonstrate strength by traversing mild ion storms. Their art incorporates metallic textures and abrasive patterns.",
    accent: "#F97316",
    icon: "shield",
    order: 39,
  },
  {
    name: "Viren",
    slug: "viren",
    category: "species",
    description:
      "Homeworld: Virenos. Environment: Dense fungal jungles with airborne neurotoxins. Primary Ability: Neurotoxin filtration and neutralization.\n\nPHYSIOLOGY — Viren possess respiratory systems equipped with neurotoxin neutralizing membranes. Their blood contains enzymes that break down airborne toxins before they reach neural tissue. Viren dermal layers secrete protective oils that repel harmful spores. Their musculature is flexible and optimized for movement through dense jungle terrain.\n\nENVIRONMENTAL ADAPTATION — Virenos’s fungal jungles produce airborne neurotoxins that incapacitate most species. Early Viren evolved filtration membranes and enzymatic blood chemistry to survive prolonged exposure. Their ability to neutralize toxins allowed them to hunt, build, and travel safely through hazardous terrain.\n\nMIGRATION PATTERN — Viren are common in xenobiology labs, hazardous environment colonies, and toxin rich ecosystems. Their physiology makes them valuable in roles requiring toxin management.\n\nSTAR FORCE SUITABILITY — Hazard ops, biological containment, infiltration, and environmental stabilization.\n\nCULTURAL NOTES — Viren culture values caution, knowledge, and respect for biological complexity. Rituals involve toxin mapping ceremonies where participants interpret fungal growth patterns. Their art incorporates organic shapes inspired by jungle ecosystems.",
    accent: "#4ADE80",
    icon: "shield",
    order: 40,
  },
  {
    name: "Solvani",
    slug: "solvani",
    category: "species",
    description:
      "Homeworld: Solvan. Environment: High pressure ocean trenches with bioluminescent predators. Primary Ability: Bioluminescent counter illumination.\n\nPHYSIOLOGY — Solvani possess dermal bioluminescent organs capable of emitting controlled light patterns. Their bodies can counter illuminate to match ambient light, rendering them nearly invisible to predators. Solvani musculature is hydrodynamic, allowing rapid movement through deep water. Their eyes are adapted for low light visibility and can detect faint bioluminescent signals.\n\nENVIRONMENTAL ADAPTATION — Solvan’s ocean trenches are filled with bioluminescent predators that hunt by light contrast. Early Solvani evolved counter illumination to evade detection. Their ability to match ambient light allowed them to navigate deep sea terrain and avoid predators.\n\nMIGRATION PATTERN — Solvani thrive in aquatic colonies, deep sea research stations, and environments requiring stealth in low light conditions.\n\nSTAR FORCE SUITABILITY — Aquatic ops, stealth reconnaissance, EVA operations, and hazard environment missions.\n\nCULTURAL NOTES — Solvani culture values subtlety, harmony, and fluid motion. Rituals involve bioluminescent performances that create shifting patterns in dark water. Their art emphasizes light, shadow, and underwater themes.",
    accent: "#0EA5E9",
    icon: "sparkles",
    order: 41,
  },
  {
    name: "Krythar",
    slug: "krythar",
    category: "species",
    description:
      "Homeworld: Krythos. Environment: Glacial plains with subzero ion winds. Primary Ability: Ion wind thermal buffering.\n\nPHYSIOLOGY — Krythar possess dermal layers reinforced with ion resistant fibers that protect against subzero ion winds. Their bodies include thermal buffering organs that regulate internal temperature during exposure to extreme cold. Krythar musculature remains flexible even in freezing conditions due to cryo resistant proteins. Their neural pathways include ion shielding sheaths that prevent electrical interference.\n\nENVIRONMENTAL ADAPTATION — Krythos’s glacial plains produce ion winds capable of freezing and electrically stunning organisms. Early Krythar evolved thermal buffering and ion resistance to survive prolonged exposure. Their ability to withstand cold and electrical interference allowed them to hunt and build in harsh environments.\n\nMIGRATION PATTERN — Krythar are common in polar colonies, cryogenic research stations, and environments requiring cold endurance.\n\nSTAR FORCE SUITABILITY — Hazard ops, cryogenic engineering, polar reconnaissance, and deep space survival.\n\nCULTURAL NOTES — Krythar culture values endurance, clarity, and stillness. Rituals involve ice wind ceremonies where participants stand in controlled ion winds to demonstrate resilience. Their art emphasizes cold hues and crystalline patterns.",
    accent: "#818CF8",
    icon: "moon",
    order: 42,
  },
  {
    name: "Virellan",
    slug: "virellan",
    category: "species",
    description:
      "Homeworld: Virellos. Environment: Dense coral forests with bioelectric predators. Primary Ability: Bioelectric pulse generation.\n\nPHYSIOLOGY — Virellan possess bioelectric organs capable of generating controlled electrical pulses. Their dermal layers include conductive pathways that allow electricity to travel safely across their bodies. Virellan musculature is supported by ion stabilizing proteins that maintain function during electrical discharge. Their eyes can detect bioelectric signatures in coral forests.\n\nENVIRONMENTAL ADAPTATION — Virellos’s coral forests are filled with predators that hunt using bioelectric fields. Early Virellan evolved pulse generation to disrupt predator senses and communicate through electrical patterns. Their ability to detect bioelectric signatures allowed them to navigate complex coral terrain.\n\nMIGRATION PATTERN — Virellan thrive in electronic warfare units, sensor arrays, and environments requiring electrical resilience.\n\nSTAR FORCE SUITABILITY — Electronic warfare, sensor operations, hazard ops, and infiltration.\n\nCULTURAL NOTES — Virellan culture values intensity, precision, and controlled energy. Rituals involve pulse synchronization ceremonies where participants generate patterned electrical displays. Their art incorporates conductive materials that respond to electrical stimuli.",
    accent: "#E6A817",
    icon: "zap",
    order: 43,
  },
  {
    name: "Thryssian",
    slug: "thryssian",
    category: "species",
    description:
      "Homeworld: Thryss. Environment: Dense fog plains with low visibility predators. Primary Ability: Fog phase perception.\n\nPHYSIOLOGY — Thryssians possess sensory organs capable of detecting movement through dense fog. Their eyes are tuned to perceive subtle shifts in light diffusion. Thryssian dermal layers include moisture absorbent fibers that prevent fog accumulation. Their musculature is optimized for silent movement through low visibility terrain.\n\nENVIRONMENTAL ADAPTATION — Thryss’s fog plains create environments where visibility is minimal. Early Thryssians evolved fog phase perception to detect predators and navigate terrain. Their ability to interpret light diffusion allowed them to survive in environments where most species were blind.\n\nMIGRATION PATTERN — Thryssians thrive in reconnaissance roles, stealth colonies, and environments requiring low visibility navigation.\n\nSTAR FORCE SUITABILITY — Reconnaissance, infiltration, sensor operations, and stealth missions.\n\nCULTURAL NOTES — Thryssian culture values subtlety, awareness, and quiet communication. Rituals involve fog phase dances where participants move through mist in coordinated patterns. Their art emphasizes translucence and shifting forms.",
    accent: "#8B5CF6",
    icon: "ghost",
    order: 44,
  },
  {
    name: "Orlathi",
    slug: "orlathi",
    category: "species",
    description:
      "Homeworld: Orlath. Environment: High density mineral forests with shifting crystalline growth. Primary Ability: Mineral sense navigation.\n\nPHYSIOLOGY — Orlathi possess sensory organs capable of detecting mineral density and crystalline growth patterns. Their dermal layers include mineral responsive fibers that vibrate in proximity to certain crystal types. Orlathi musculature is compact and optimized for movement through dense mineral forests.\n\nENVIRONMENTAL ADAPTATION — Orlath’s mineral forests shift unpredictably as crystalline growth expands or collapses. Early Orlathi evolved mineral sense navigation to detect structural weaknesses and safe paths. Their ability to interpret mineral patterns allowed them to survive in environments where terrain changed daily.\n\nMIGRATION PATTERN — Orlathi thrive in mining colonies, geological research stations, and environments requiring mineral analysis.\n\nSTAR FORCE SUITABILITY — Reconnaissance, structural analysis, hazard ops, and infiltration.\n\nCULTURAL NOTES — Orlathi culture values stability, awareness, and harmony with mineral growth. Rituals involve crystal mapping ceremonies where participants interpret mineral patterns. Their art incorporates crystalline structures and geometric designs.",
    accent: "#94A3B8",
    icon: "mountain",
    order: 45,
  },
  {
    name: "Sylvran",
    slug: "sylvran",
    category: "species",
    description:
      "Homeworld: Sylvra. Environment: Dense vine forests with rapid growth cycles. Primary Ability: Bio entanglement limb control.\n\nPHYSIOLOGY — Sylvran possess limbs capable of manipulating vines and plant matter through micro tension control. Their musculature includes flexible fiber bundles that allow precise movement through dense vegetation. Sylvran dermal layers secrete oils that prevent entanglement and reduce friction.\n\nENVIRONMENTAL ADAPTATION — Sylvra’s vine forests grow rapidly, creating shifting terrain. Early Sylvran evolved bio entanglement control to navigate dense vegetation and manipulate vines for shelter or hunting. Their ability to control plant matter became central to their survival.\n\nMIGRATION PATTERN — Sylvran thrive in botanical colonies, terraforming operations, and environments requiring plant manipulation.\n\nSTAR FORCE SUITABILITY — Reconnaissance, environmental engineering, stealth operations, and infiltration.\n\nCULTURAL NOTES — Sylvran culture values growth, harmony, and adaptability. Rituals involve vine weaving ceremonies where participants shape living plants into symbolic forms. Their art emphasizes organic shapes and flowing patterns.",
    accent: "#4ADE80",
    icon: "feather",
    order: 46,
  },
  {
    name: "Kryllos",
    slug: "kryllos",
    category: "species",
    description:
      "Homeworld: Kryllon. Environment: Subterranean frost caverns with bioluminescent ice. Primary Ability: Frost light emission.\n\nPHYSIOLOGY — Kryllos possess dermal organs capable of emitting cold bioluminescent light. Their bodies can regulate internal temperature to produce frost light without freezing themselves. Kryllos musculature remains flexible in subzero conditions due to cryo resistant proteins. Their eyes are adapted for low light visibility.\n\nENVIRONMENTAL ADAPTATION — Kryllon’s frost caverns produce bioluminescent ice that shifts with temperature. Early Kryllos evolved frost light emission to communicate, navigate, and deter predators. Their ability to produce cold light allowed them to survive in environments where heat sources were scarce.\n\nMIGRATION PATTERN — Kryllos thrive in polar colonies, cryogenic research stations, and environments requiring low light navigation.\n\nSTAR FORCE SUITABILITY — Reconnaissance, hazard ops, cryogenic engineering, and stealth missions.\n\nCULTURAL NOTES — Kryllos culture values stillness, clarity, and cold beauty. Rituals involve frost light ceremonies where participants create glowing patterns in ice. Their art emphasizes crystalline shapes and cold hues.",
    accent: "#A78BFA",
    icon: "sparkles",
    order: 47,
  },
  {
    name: "Vornathi",
    slug: "vornathi",
    category: "species",
    description:
      "Homeworld: Vornath. Environment: Dense volcanic caverns with toxic fumes. Primary Ability: Fume neutralizing respiration.\n\nPHYSIOLOGY — Vornathi possess respiratory systems equipped with toxin neutralizing membranes. Their blood contains enzymes that break down volcanic fumes before they reach neural tissue. Vornathi dermal layers include heat resistant fibers that protect against radiant energy. Their musculature is compact and optimized for movement through narrow volcanic tunnels.\n\nENVIRONMENTAL ADAPTATION — Vornath’s volcanic caverns produce toxic fumes that incapacitate most species. Early Vornathi evolved fume neutralizing respiration to survive prolonged exposure. Their ability to dissolve toxins allowed them to navigate hazardous terrain.\n\nMIGRATION PATTERN — Vornathi thrive in volcanic colonies, hazard environment research stations, and environments requiring toxin resistance.\n\nSTAR FORCE SUITABILITY — Hazard ops, infiltration, breaching, and environmental stabilization.\n\nCULTURAL NOTES — Vornathi culture values endurance, transformation, and respect for volcanic forces. Rituals involve fume mapping ceremonies where participants interpret gas patterns. Their art incorporates molten textures and flowing shapes.",
    accent: "#F77F2A",
    icon: "shield",
    order: 48,
  },
  {
    name: "Thalvori",
    slug: "thalvori",
    category: "species",
    description:
      "Homeworld: Thalvor. Environment: High gravity crystalline plains. Primary Ability: Gravitic crystal resonance.\n\nPHYSIOLOGY — Thalvori possess crystalline organ structures that resonate under gravitational pressure. Their bodies can stabilize themselves in high gravity environments by harmonizing with local gravitational fields. Thalvori musculature is dense and optimized for movement under crushing force.\n\nENVIRONMENTAL ADAPTATION — Thalvor’s crystalline plains produce gravitational fluctuations that can crush most species. Early Thalvori evolved gravitic resonance to survive sudden pressure changes. Their ability to harmonize with gravity allowed them to navigate terrain safely.\n\nMIGRATION PATTERN — Thalvori thrive in high gravity colonies, mining operations, and environments requiring gravitational stability.\n\nSTAR FORCE SUITABILITY — Heavy infantry, hazard ops, breaching, and EVA operations.\n\nCULTURAL NOTES — Thalvori culture values strength, stability, and harmony with gravitational forces. Rituals involve gravitic resonance ceremonies where participants synchronize with local gravity. Their art incorporates crystalline shapes and heavy geometric patterns.",
    accent: "#F97316",
    icon: "weight",
    order: 49,
  },
  {
    name: "Arkanis",
    slug: "arkanis",
    category: "species",
    description:
      "Homeworld: Arkanor. Environment: Dense storm cloud world with perpetual lightning. Primary Ability: Storm sense electroperception.\n\nPHYSIOLOGY — Arkanis possess sensory organs capable of detecting electrical fields generated by storm clouds. Their dermal layers include conductive pathways that allow them to withstand lightning strikes. Arkanis musculature is reinforced with ion stabilizing proteins that maintain function during electrical exposure.\n\nENVIRONMENTAL ADAPTATION — Arkanor’s storm cloud world produces perpetual lightning storms. Early Arkanis evolved storm sense electroperception to detect lightning patterns and navigate safely. Their ability to interpret electrical fields allowed them to survive in environments where visibility was minimal.\n\nMIGRATION PATTERN — Arkanis thrive in electronic warfare units, sensor arrays, and environments requiring electrical resilience.\n\nSTAR FORCE SUITABILITY — Electronic warfare, reconnaissance, hazard ops, and infiltration.\n\nCULTURAL NOTES — Arkanis culture values intensity, awareness, and harmony with storm forces. Rituals involve lightning sense ceremonies where participants interpret electrical patterns. Their art incorporates storm motifs and dynamic shapes.",
    accent: "#E6A817",
    icon: "zap",
    order: 50,
  },

  // ---- Section V — Species 51–65 -----------------------------------------
  {
    name: "Arvathi",
    slug: "arvathi",
    category: "species",
    description:
      "Homeworld: Arvath. Environment: Dense subterranean crystal warrens with refractive light pockets. Primary Ability: Subsurface light pulse navigation.\n\nPHYSIOLOGY — Arvathi possess crystalline nodules embedded beneath their skin that emit faint pulses of light. These pulses bounce through subterranean crystal formations, returning refractive echoes that Arvathi interpret through specialized ocular membranes. Their eyes contain multi layered lenses capable of perceiving subtle shifts in refracted light, giving them a detailed map of underground terrain. Their musculature is compact and optimized for crawling, climbing, and squeezing through narrow crystal fissures. Arvathi dermal layers are reinforced with mineral fibers that protect against sharp crystal edges.\n\nENVIRONMENTAL ADAPTATION — Arvath’s subterranean warrens are labyrinthine, with refractive light pockets that distort perception. Early Arvathi evolved light pulse navigation to detect predators, locate resources, and avoid collapses. Their ability to interpret refractive echoes allowed them to survive in environments where traditional vision was unreliable. Over time, subsurface navigation became central to Arvathi identity.\n\nMIGRATION PATTERN — Arvathi thrive in mining colonies, subterranean research stations, and environments requiring underground navigation. Their physiology makes them valuable in roles requiring precise spatial awareness.\n\nSTAR FORCE SUITABILITY — Infiltration, subterranean reconnaissance, hazard ops, and structural analysis.\n\nCULTURAL NOTES — Arvathi culture values clarity, perception, and harmony with crystalline environments. Rituals involve light pulse ceremonies where participants create refractive patterns in crystal chambers. Their art emphasizes symmetry, reflection, and geometric forms.",
    accent: "#A78BFA",
    icon: "eye",
    order: 51,
  },
  {
    name: "Vornyx",
    slug: "vornyx",
    category: "species",
    description:
      "Homeworld: Vornyxia. Environment: High density fungal jungles with corrosive spores. Primary Ability: Corrosion resistant dermal chemistry.\n\nPHYSIOLOGY — Vornyx possess dermal layers coated with corrosion resistant oils that neutralize acidic spores. Their respiratory system includes filtration membranes that dissolve corrosive particulates before they reach lung tissue. Vornyx musculature is flexible and optimized for movement through dense fungal terrain. Their neural pathways include toxin resistant sheaths that protect against corrosive neurotoxins.\n\nENVIRONMENTAL ADAPTATION — Vornyxia’s fungal jungles produce corrosive spores capable of dissolving organic matter. Early Vornyx evolved dermal chemistry to neutralize acids and survive prolonged exposure. Their ability to resist corrosion allowed them to navigate hazardous terrain and harvest fungal resources.\n\nMIGRATION PATTERN — Vornyx are common in xenobiology labs, hazardous environment colonies, and ecosystems requiring corrosion resistance.\n\nSTAR FORCE SUITABILITY — Hazard ops, biological containment, infiltration, and environmental stabilization.\n\nCULTURAL NOTES — Vornyx culture values caution, precision, and respect for corrosive environments. Rituals involve spore mapping ceremonies where participants interpret fungal growth patterns. Their art incorporates organic shapes inspired by jungle ecosystems.",
    accent: "#4ADE80",
    icon: "shield",
    order: 52,
  },
  {
    name: "Sylvori",
    slug: "sylvori",
    category: "species",
    description:
      "Homeworld: Sylvor. Environment: Dense arboreal world with rapid growth cycles. Primary Ability: Photosynthetic energy storage.\n\nPHYSIOLOGY — Sylvori possess dermal layers embedded with photosynthetic organelles that store solar energy. Their skin shifts in hue depending on light exposure, brightening during photosynthesis and darkening during rest. Sylvori musculature is lightweight and optimized for movement through dense canopy networks. Their neural pathways include light responsive nodes that enhance alertness during daylight.\n\nENVIRONMENTAL ADAPTATION — Sylvor’s arboreal ecosystems rely on dense canopy networks that filter sunlight. Early Sylvori evolved photosynthetic storage to survive periods of limited food availability. Their ability to metabolize light allowed them to remain active during long treks through forest terrain.\n\nMIGRATION PATTERN — Sylvori thrive in ecological colonies, botanical research stations, and environments requiring environmental harmony.\n\nSTAR FORCE SUITABILITY — Reconnaissance, environmental analysis, stealth operations, and long range scouting.\n\nCULTURAL NOTES — Sylvori culture values growth, harmony, and connection to natural cycles. Rituals involve sun gathering ceremonies where participants synchronize photosynthetic activity. Their art emphasizes organic shapes and vibrant colors.",
    accent: "#4ADE80",
    icon: "sun",
    order: 53,
  },
  {
    name: "Drathen",
    slug: "drathen",
    category: "species",
    description:
      "Homeworld: Drathos. Environment: Volcanic fissure networks with toxic gas vents. Primary Ability: Gas phase respiration.\n\nPHYSIOLOGY — Drathen possess respiratory systems capable of extracting oxygen from toxic gas mixtures. Their lungs include chemical neutralizing membranes that filter harmful particulates. Drathen dermal layers are reinforced with heat resistant fibers that protect against radiant energy. Their musculature is compact and optimized for movement through narrow volcanic tunnels.\n\nENVIRONMENTAL ADAPTATION — Drathos’s volcanic fissures produce toxic gas vents that incapacitate most species. Early Drathen evolved gas phase respiration to survive prolonged exposure. Their ability to filter toxins allowed them to navigate hazardous terrain and harvest volcanic resources.\n\nMIGRATION PATTERN — Drathen thrive in volcanic colonies, hazard environment research stations, and environments requiring toxin resistance.\n\nSTAR FORCE SUITABILITY — Hazard ops, infiltration, breaching, and environmental stabilization.\n\nCULTURAL NOTES — Drathen culture values endurance, transformation, and respect for volcanic forces. Rituals involve gas mapping ceremonies where participants interpret vent patterns. Their art incorporates molten textures and flowing shapes.",
    accent: "#F77F2A",
    icon: "wind",
    order: 54,
  },
  {
    name: "Arvathori",
    slug: "arvathori",
    category: "species",
    description:
      "Homeworld: Arvathor. Environment: High gravity crystalline ridges. Primary Ability: Gravitic ridge climbing.\n\nPHYSIOLOGY — Arvathori possess dense musculature and reinforced skeletal structures capable of withstanding extreme gravitational pressure. Their limbs include micro grip pads that allow them to climb crystalline ridges without slipping. Arvathori dermal layers are reinforced with mineral fibers that protect against sharp crystal edges. Their cardiovascular system is optimized for circulation under crushing force.\n\nENVIRONMENTAL ADAPTATION — Arvathor’s crystalline ridges produce gravitational fluctuations that can crush most species. Early Arvathori evolved gravitic endurance and climbing adaptations to survive sudden pressure changes. Their ability to navigate ridges safely became central to their identity.\n\nMIGRATION PATTERN — Arvathori thrive in high gravity colonies, mining operations, and environments requiring gravitational stability.\n\nSTAR FORCE SUITABILITY — Heavy infantry, hazard ops, breaching, and EVA operations.\n\nCULTURAL NOTES — Arvathori culture values strength, stability, and harmony with gravitational forces. Rituals involve ridge climbing ceremonies where participants demonstrate endurance. Their art incorporates crystalline shapes and heavy geometric patterns.",
    accent: "#F97316",
    icon: "mountain",
    order: 55,
  },
  {
    name: "Vyrnathi",
    slug: "vyrnathi",
    category: "species",
    description:
      "Homeworld: Vyrnath. Environment: Dense fog marshes with bioluminescent predators. Primary Ability: Fog light modulation.\n\nPHYSIOLOGY — Vyrnathi possess dermal organs capable of emitting controlled bioluminescent light. Their bodies can modulate light intensity to navigate fog rich environments. Vyrnathi eyes are tuned to perceive subtle shifts in light diffusion. Their musculature is optimized for silent movement through dense marsh terrain.\n\nENVIRONMENTAL ADAPTATION — Vyrnath’s fog marshes create environments where visibility is minimal. Early Vyrnathi evolved fog light modulation to detect predators and navigate terrain. Their ability to interpret light diffusion allowed them to survive in environments where most species were blind.\n\nMIGRATION PATTERN — Vyrnathi thrive in reconnaissance roles, stealth colonies, and environments requiring low visibility navigation.\n\nSTAR FORCE SUITABILITY — Reconnaissance, infiltration, sensor operations, and stealth missions.\n\nCULTURAL NOTES — Vyrnathi culture values subtlety, awareness, and quiet communication. Rituals involve fog light dances where participants create shifting patterns in mist. Their art emphasizes translucence and flowing forms.",
    accent: "#8B5CF6",
    icon: "sparkles",
    order: 56,
  },
  {
    name: "Kryvath",
    slug: "kryvath",
    category: "species",
    description:
      "Homeworld: Kryvathos. Environment: Subzero plains with ion charged snow. Primary Ability: Ion snow thermal regulation.\n\nPHYSIOLOGY — Kryvath possess dermal layers reinforced with ion resistant fibers that protect against charged snow. Their bodies include thermal regulating organs that maintain internal temperature during exposure to extreme cold. Kryvath musculature remains flexible even in freezing conditions due to cryo resistant proteins.\n\nENVIRONMENTAL ADAPTATION — Kryvathos’s plains produce ion charged snow capable of freezing and electrically stunning organisms. Early Kryvath evolved thermal regulation and ion resistance to survive prolonged exposure. Their ability to withstand cold and electrical interference allowed them to hunt and build in harsh environments.\n\nMIGRATION PATTERN — Kryvath are common in polar colonies, cryogenic research stations, and environments requiring cold endurance.\n\nSTAR FORCE SUITABILITY — Hazard ops, cryogenic engineering, polar reconnaissance, and deep space survival.\n\nCULTURAL NOTES — Kryvath culture values endurance, clarity, and stillness. Rituals involve ion snow ceremonies where participants stand in charged snow to demonstrate resilience. Their art emphasizes cold hues and crystalline patterns.",
    accent: "#818CF8",
    icon: "moon",
    order: 57,
  },
  {
    name: "Sylvrax",
    slug: "sylvrax",
    category: "species",
    description:
      "Homeworld: Sylvraxia. Environment: Dense vine forests with rapid growth cycles. Primary Ability: Vine sense navigation.\n\nPHYSIOLOGY — Sylvrax possess sensory organs capable of detecting vine growth patterns and plant movement. Their limbs include flexible fiber bundles that allow precise movement through dense vegetation. Sylvrax dermal layers secrete oils that prevent entanglement and reduce friction.\n\nENVIRONMENTAL ADAPTATION — Sylvraxia’s vine forests grow rapidly, creating shifting terrain. Early Sylvrax evolved vine sense navigation to detect structural weaknesses and safe paths. Their ability to interpret plant movement allowed them to survive in environments where terrain changed daily.\n\nMIGRATION PATTERN — Sylvrax thrive in botanical colonies, terraforming operations, and environments requiring plant manipulation.\n\nSTAR FORCE SUITABILITY — Reconnaissance, environmental engineering, stealth operations, and infiltration.\n\nCULTURAL NOTES — Sylvrax culture values growth, harmony, and adaptability. Rituals involve vine mapping ceremonies where participants interpret plant patterns. Their art emphasizes organic shapes and flowing forms.",
    accent: "#4ADE80",
    icon: "feather",
    order: 58,
  },
  {
    name: "Thalvrax",
    slug: "thalvrax",
    category: "species",
    description:
      "Homeworld: Thalvraxos. Environment: High gravity volcanic plains. Primary Ability: Gravitic heat endurance.\n\nPHYSIOLOGY — Thalvrax possess dense musculature and reinforced skeletal structures capable of withstanding extreme gravitational pressure. Their bodies include heat resistant dermal layers that protect against volcanic surges. Thalvrax neural pathways include heat buffering sheaths that prevent thermal overload.\n\nENVIRONMENTAL ADAPTATION — Thalvraxos’s volcanic plains produce gravitational fluctuations and heat surges. Early Thalvrax evolved gravitic endurance and heat resistance to survive sudden environmental changes. Their ability to withstand heat and pressure allowed them to navigate hazardous terrain.\n\nMIGRATION PATTERN — Thalvrax thrive in high gravity colonies, volcanic research stations, and environments requiring heat tolerance.\n\nSTAR FORCE SUITABILITY — Heavy infantry, hazard ops, breaching, and EVA operations.\n\nCULTURAL NOTES — Thalvrax culture values strength, endurance, and harmony with volcanic forces. Rituals involve heat endurance ceremonies where participants demonstrate resilience. Their art incorporates molten textures and heavy geometric patterns.",
    accent: "#F97316",
    icon: "weight",
    order: 59,
  },
  {
    name: "Arvexori",
    slug: "arvexori",
    category: "species",
    description:
      "Homeworld: Arvexor. Environment: Crystal reef archipelagos with refractive light fields. Primary Ability: Phase shifted vision.\n\nPHYSIOLOGY — Arvexori possess multi layered crystalline lenses that refract light into multiple spectral bands. Their eyes can perceive phase shifted wavelengths invisible to most species. Arvexori dermal layers include reflective micro crystals that protect against intense glare.\n\nENVIRONMENTAL ADAPTATION — Arvexor’s crystal reef archipelagos create refractive light fields that distort perception. Early Arvexori evolved phase shifted vision to navigate environments where light bends unpredictably. Their ability to interpret refractive distortions allowed them to detect predators and locate safe paths.\n\nMIGRATION PATTERN — Arvexori thrive in sensor operations, navigation roles, and optical research.\n\nSTAR FORCE SUITABILITY — Reconnaissance, sensor calibration, optical analysis, and navigation.\n\nCULTURAL NOTES — Arvexori culture values clarity, perception, and the beauty of refracted light. Rituals involve phase shift ceremonies where participants create refractive patterns. Their art emphasizes symmetry and optical illusion.",
    accent: "#34D399",
    icon: "eye",
    order: 60,
  },
  {
    name: "Sylvathen",
    slug: "sylvathen",
    category: "species",
    description:
      "Homeworld: Sylvath. Environment: Dense arboreal world with photosynthetic canopy networks. Primary Ability: Photosynthetic metabolic augmentation.\n\nPHYSIOLOGY — Sylvathen possess dermal layers embedded with photosynthetic organelles that supplement metabolic energy. Their skin shifts in hue depending on light exposure. Sylvathen musculature is lightweight and optimized for movement through dense canopy networks.\n\nENVIRONMENTAL ADAPTATION — Sylvath’s arboreal ecosystems rely on dense canopy networks that filter sunlight. Early Sylvathen evolved photosynthetic augmentation to survive periods of limited food availability.\n\nMIGRATION PATTERN — Sylvathen thrive in ecological colonies, botanical research stations, and environments requiring environmental harmony.\n\nSTAR FORCE SUITABILITY — Reconnaissance, environmental analysis, stealth operations, and long range scouting.\n\nCULTURAL NOTES — Sylvathen culture values growth, harmony, and connection to natural cycles. Rituals involve sun gathering ceremonies. Their art emphasizes organic shapes and vibrant colors.",
    accent: "#4ADE80",
    icon: "sun",
    order: 61,
  },
  {
    name: "Kryvori",
    slug: "kryvori",
    category: "species",
    description:
      "Homeworld: Kryvor. Environment: Subzero plains with ion charged snow. Primary Ability: Ion snow thermal regulation.\n\nPHYSIOLOGY — Kryvori possess dermal layers reinforced with ion resistant fibers that protect against charged snow. Their bodies include thermal regulating organs that maintain internal temperature during exposure to extreme cold.\n\nENVIRONMENTAL ADAPTATION — Kryvor’s plains produce ion charged snow capable of freezing and electrically stunning organisms. Early Kryvori evolved thermal regulation and ion resistance to survive prolonged exposure.\n\nMIGRATION PATTERN — Kryvori are common in polar colonies, cryogenic research stations, and environments requiring cold endurance.\n\nSTAR FORCE SUITABILITY — Hazard ops, cryogenic engineering, polar reconnaissance, and deep space survival.\n\nCULTURAL NOTES — Kryvori culture values endurance, clarity, and stillness. Rituals involve ion snow ceremonies. Their art emphasizes cold hues and crystalline patterns.",
    accent: "#818CF8",
    icon: "moon",
    order: 62,
  },
  {
    name: "Vornyxen",
    slug: "vornyxen",
    category: "species",
    description:
      "Homeworld: Vornyxen Prime. Environment: Dense fungal jungles with corrosive spores. Primary Ability: Corrosion resistant dermal chemistry.\n\nPHYSIOLOGY — Vornyxen possess dermal layers coated with corrosion resistant oils that neutralize acidic spores. Their respiratory system includes filtration membranes that dissolve corrosive particulates.\n\nENVIRONMENTAL ADAPTATION — Vornyxen Prime’s fungal jungles produce corrosive spores capable of dissolving organic matter. Early Vornyxen evolved dermal chemistry to neutralize acids.\n\nMIGRATION PATTERN — Vornyxen thrive in xenobiology labs, hazardous environment colonies, and ecosystems requiring corrosion resistance.\n\nSTAR FORCE SUITABILITY — Hazard ops, biological containment, infiltration, and environmental stabilization.\n\nCULTURAL NOTES — Vornyxen culture values caution, precision, and respect for corrosive environments. Rituals involve spore mapping ceremonies. Their art incorporates organic shapes inspired by jungle ecosystems.",
    accent: "#4ADE80",
    icon: "shield",
    order: 63,
  },
  {
    name: "Sylvraxen",
    slug: "sylvraxen",
    category: "species",
    description:
      "Homeworld: Sylvraxen. Environment: Dense vine forests with rapid growth cycles. Primary Ability: Vine sense navigation.\n\nPHYSIOLOGY — Sylvraxen possess sensory organs capable of detecting vine growth patterns and plant movement. Their limbs include flexible fiber bundles that allow precise movement through dense vegetation.\n\nENVIRONMENTAL ADAPTATION — Sylvraxen’s vine forests grow rapidly, creating shifting terrain. Early Sylvraxen evolved vine sense navigation to detect structural weaknesses and safe paths.\n\nMIGRATION PATTERN — Sylvraxen thrive in botanical colonies, terraforming operations, and environments requiring plant manipulation.\n\nSTAR FORCE SUITABILITY — Reconnaissance, environmental engineering, stealth operations, and infiltration.\n\nCULTURAL NOTES — Sylvraxen culture values growth, harmony, and adaptability. Rituals involve vine mapping ceremonies. Their art emphasizes organic shapes and flowing forms.",
    accent: "#4ADE80",
    icon: "feather",
    order: 64,
  },
  {
    name: "Thalvorith",
    slug: "thalvorith",
    category: "species",
    description:
      "Homeworld: Thalvorithos. Environment: High gravity volcanic plains. Primary Ability: Gravitic heat endurance.\n\nPHYSIOLOGY — Thalvorith possess dense musculature and reinforced skeletal structures capable of withstanding extreme gravitational pressure. Their bodies include heat resistant dermal layers that protect against volcanic surges.\n\nENVIRONMENTAL ADAPTATION — Thalvorithos’s volcanic plains produce gravitational fluctuations and heat surges. Early Thalvorith evolved gravitic endurance and heat resistance to survive sudden environmental changes.\n\nMIGRATION PATTERN — Thalvorith thrive in high gravity colonies, volcanic research stations, and environments requiring heat tolerance.\n\nSTAR FORCE SUITABILITY — Heavy infantry, hazard ops, breaching, and EVA operations.\n\nCULTURAL NOTES — Thalvorith culture values strength, endurance, and harmony with volcanic forces. Rituals involve heat endurance ceremonies. Their art incorporates molten textures and heavy geometric patterns.",
    accent: "#F97316",
    icon: "weight",
    order: 65,
  },

  // ---- Section VI — Species 66–75 ----------------------------------------
  {
    name: "Arkanth",
    slug: "arkanth",
    category: "species",
    description:
      "Homeworld: Arkanthos. Environment: Perpetual storm belt world with hyper charged atmospheric vortices. Primary Ability: Vortex sense electro aerodynamic perception.\n\nPHYSIOLOGY — Arkanth possess sensory organs capable of detecting rotational electrical fields generated by atmospheric vortices. Their dermal layers include conductive pathways that allow them to withstand sudden electrical discharges. Arkanth musculature is reinforced with ion stabilizing proteins that maintain function during high velocity wind exposure. Their respiratory system includes particulate filtering membranes that prevent damage during storm traversal.\n\nENVIRONMENTAL ADAPTATION — Arkanthos’s storm belts generate hyper charged vortices capable of tearing apart most organisms. Early Arkanth evolved vortex sense perception to detect rotational patterns and navigate safely. Their ability to interpret electrical and aerodynamic cues allowed them to survive in environments where visibility was minimal and danger was constant.\n\nMIGRATION PATTERN — Arkanth thrive in electronic warfare units, atmospheric research stations, and environments requiring storm navigation. Their physiology makes them valuable in roles requiring electrical resilience and aerodynamic awareness.\n\nSTAR FORCE SUITABILITY — Electronic warfare, reconnaissance, hazard ops, and infiltration.\n\nCULTURAL NOTES — Arkanth culture values intensity, awareness, and harmony with storm forces. Rituals involve vortex sense ceremonies where participants interpret rotational electrical patterns. Their art incorporates storm motifs and dynamic shapes.",
    accent: "#E6A817",
    icon: "zap",
    order: 66,
  },
  {
    name: "Sylvarin",
    slug: "sylvarin",
    category: "species",
    description:
      "Homeworld: Sylvaris. Environment: Dense arboreal world with bioluminescent canopy networks. Primary Ability: Canopy light modulation.\n\nPHYSIOLOGY — Sylvarin possess dermal organs capable of emitting controlled bioluminescent light. Their bodies can modulate light intensity to navigate dense canopy networks. Sylvarin eyes are tuned to perceive subtle shifts in light diffusion. Their musculature is optimized for silent movement through forest terrain.\n\nENVIRONMENTAL ADAPTATION — Sylvaris’s canopy networks create environments where light is filtered and diffused. Early Sylvarin evolved canopy light modulation to detect predators and navigate terrain. Their ability to interpret light diffusion allowed them to survive in environments where visibility was limited.\n\nMIGRATION PATTERN — Sylvarin thrive in reconnaissance roles, stealth colonies, and environments requiring low visibility navigation.\n\nSTAR FORCE SUITABILITY — Reconnaissance, infiltration, sensor operations, and stealth missions.\n\nCULTURAL NOTES — Sylvarin culture values subtlety, awareness, and quiet communication. Rituals involve canopy light dances where participants create shifting patterns in filtered light. Their art emphasizes translucence and flowing forms.",
    accent: "#8B5CF6",
    icon: "sparkles",
    order: 67,
  },
  {
    name: "Thalvren",
    slug: "thalvren",
    category: "species",
    description:
      "Homeworld: Thalvrenos. Environment: High gravity crystalline plains with seismic instability. Primary Ability: Gravitic seismic resonance.\n\nPHYSIOLOGY — Thalvren possess crystalline organ structures that resonate under gravitational pressure. Their bodies can stabilize themselves in high gravity environments by harmonizing with local gravitational fields. Thalvren musculature is dense and optimized for movement under crushing force. Their neural pathways include seismic sense nodes that detect micro vibrations.\n\nENVIRONMENTAL ADAPTATION — Thalvrenos’s crystalline plains produce gravitational fluctuations and seismic shifts. Early Thalvren evolved gravitic resonance to survive sudden pressure changes. Their ability to harmonize with gravity allowed them to navigate terrain safely.\n\nMIGRATION PATTERN — Thalvren thrive in high gravity colonies, mining operations, and environments requiring gravitational stability.\n\nSTAR FORCE SUITABILITY — Heavy infantry, hazard ops, breaching, and EVA operations.\n\nCULTURAL NOTES — Thalvren culture values strength, stability, and harmony with gravitational forces. Rituals involve seismic sense ceremonies where participants synchronize with local vibrations. Their art incorporates crystalline shapes and heavy geometric patterns.",
    accent: "#F97316",
    icon: "weight",
    order: 68,
  },
  {
    name: "Arvexian",
    slug: "arvexian",
    category: "species",
    description:
      "Homeworld: Arvexia Prime. Environment: Crystal reef archipelagos with refractive light fields. Primary Ability: Refractive phase vision.\n\nPHYSIOLOGY — Arvexian possess multi layered crystalline lenses that refract light into multiple spectral bands. Their eyes can perceive phase shifted wavelengths invisible to most species. Arvexian dermal layers include reflective micro crystals that protect against intense glare. Their musculature is optimized for movement through refractive terrain.\n\nENVIRONMENTAL ADAPTATION — Arvexia Prime’s crystal reef archipelagos create refractive light fields that distort perception. Early Arvexian evolved phase vision to navigate environments where light bends unpredictably. Their ability to interpret refractive distortions allowed them to detect predators and locate safe paths.\n\nMIGRATION PATTERN — Arvexian thrive in sensor operations, navigation roles, and optical research.\n\nSTAR FORCE SUITABILITY — Reconnaissance, sensor calibration, optical analysis, and navigation.\n\nCULTURAL NOTES — Arvexian culture values clarity, perception, and the beauty of refracted light. Rituals involve phase shift ceremonies where participants create refractive patterns. Their art emphasizes symmetry and optical illusion.",
    accent: "#34D399",
    icon: "eye",
    order: 69,
  },
  {
    name: "Sylvaroth",
    slug: "sylvaroth",
    category: "species",
    description:
      "Homeworld: Sylvarothos. Environment: Dense vine forests with rapid growth cycles. Primary Ability: Vine growth modulation.\n\nPHYSIOLOGY — Sylvaroth possess sensory organs capable of detecting vine growth patterns and plant movement. Their limbs include flexible fiber bundles that allow precise movement through dense vegetation. Sylvaroth dermal layers secrete oils that prevent entanglement and reduce friction.\n\nENVIRONMENTAL ADAPTATION — Sylvarothos’s vine forests grow rapidly, creating shifting terrain. Early Sylvaroth evolved vine growth modulation to detect structural weaknesses and safe paths. Their ability to interpret plant movement allowed them to survive in environments where terrain changed daily.\n\nMIGRATION PATTERN — Sylvaroth thrive in botanical colonies, terraforming operations, and environments requiring plant manipulation.\n\nSTAR FORCE SUITABILITY — Reconnaissance, environmental engineering, stealth operations, and infiltration.\n\nCULTURAL NOTES — Sylvaroth culture values growth, harmony, and adaptability. Rituals involve vine mapping ceremonies where participants interpret plant patterns. Their art emphasizes organic shapes and flowing forms.",
    accent: "#4ADE80",
    icon: "feather",
    order: 70,
  },
  {
    name: "Kryvathen",
    slug: "kryvathen",
    category: "species",
    description:
      "Homeworld: Kryvathen Prime. Environment: Subzero plains with ion charged snow. Primary Ability: Ion snow thermal regulation.\n\nPHYSIOLOGY — Kryvathen possess dermal layers reinforced with ion resistant fibers that protect against charged snow. Their bodies include thermal regulating organs that maintain internal temperature during exposure to extreme cold. Kryvathen musculature remains flexible even in freezing conditions due to cryo resistant proteins.\n\nENVIRONMENTAL ADAPTATION — Kryvathen Prime’s plains produce ion charged snow capable of freezing and electrically stunning organisms. Early Kryvathen evolved thermal regulation and ion resistance to survive prolonged exposure.\n\nMIGRATION PATTERN — Kryvathen are common in polar colonies, cryogenic research stations, and environments requiring cold endurance.\n\nSTAR FORCE SUITABILITY — Hazard ops, cryogenic engineering, polar reconnaissance, and deep space survival.\n\nCULTURAL NOTES — Kryvathen culture values endurance, clarity, and stillness. Rituals involve ion snow ceremonies where participants stand in charged snow to demonstrate resilience. Their art emphasizes cold hues and crystalline patterns.",
    accent: "#818CF8",
    icon: "moon",
    order: 71,
  },
  {
    name: "Vornathen",
    slug: "vornathen",
    category: "species",
    description:
      "Homeworld: Vornathen. Environment: Dense volcanic caverns with toxic fumes. Primary Ability: Fume neutralizing respiration.\n\nPHYSIOLOGY — Vornathen possess respiratory systems equipped with toxin neutralizing membranes. Their blood contains enzymes that break down volcanic fumes before they reach neural tissue. Vornathen dermal layers include heat resistant fibers that protect against radiant energy. Their musculature is compact and optimized for movement through narrow volcanic tunnels.\n\nENVIRONMENTAL ADAPTATION — Vornathen’s volcanic caverns produce toxic fumes that incapacitate most species. Early Vornathen evolved fume neutralizing respiration to survive prolonged exposure. Their ability to dissolve toxins allowed them to navigate hazardous terrain.\n\nMIGRATION PATTERN — Vornathen thrive in volcanic colonies, hazard environment research stations, and environments requiring toxin resistance.\n\nSTAR FORCE SUITABILITY — Hazard ops, infiltration, breaching, and environmental stabilization.\n\nCULTURAL NOTES — Vornathen culture values endurance, transformation, and respect for volcanic forces. Rituals involve fume mapping ceremonies where participants interpret gas patterns. Their art incorporates molten textures and flowing shapes.",
    accent: "#F77F2A",
    icon: "shield",
    order: 72,
  },
  {
    name: "Thalvorithen",
    slug: "thalvorithen",
    category: "species",
    description:
      "Homeworld: Thalvorithen. Environment: High gravity volcanic plains. Primary Ability: Gravitic heat endurance.\n\nPHYSIOLOGY — Thalvorithen possess dense musculature and reinforced skeletal structures capable of withstanding extreme gravitational pressure. Their bodies include heat resistant dermal layers that protect against volcanic surges. Thalvorithen neural pathways include heat buffering sheaths that prevent thermal overload.\n\nENVIRONMENTAL ADAPTATION — Thalvorithen’s volcanic plains produce gravitational fluctuations and heat surges. Early Thalvorithen evolved gravitic endurance and heat resistance to survive sudden environmental changes.\n\nMIGRATION PATTERN — Thalvorithen thrive in high gravity colonies, volcanic research stations, and environments requiring heat tolerance.\n\nSTAR FORCE SUITABILITY — Heavy infantry, hazard ops, breaching, and EVA operations.\n\nCULTURAL NOTES — Thalvorithen culture values strength, endurance, and harmony with volcanic forces. Rituals involve heat endurance ceremonies. Their art incorporates molten textures and heavy geometric patterns.",
    accent: "#F97316",
    icon: "weight",
    order: 73,
  },
  {
    name: "Arvexorin",
    slug: "arvexorin",
    category: "species",
    description:
      "Homeworld: Arvexorin. Environment: Crystal reef archipelagos with refractive light fields. Primary Ability: Phase shifted refractive vision.\n\nPHYSIOLOGY — Arvexorin possess multi layered crystalline lenses that refract light into multiple spectral bands. Their eyes can perceive phase shifted wavelengths invisible to most species. Arvexorin dermal layers include reflective micro crystals that protect against intense glare.\n\nENVIRONMENTAL ADAPTATION — Arvexorin’s crystal reef archipelagos create refractive light fields that distort perception. Early Arvexorin evolved phase shifted vision to navigate environments where light bends unpredictably.\n\nMIGRATION PATTERN — Arvexorin thrive in sensor operations, navigation roles, and optical research.\n\nSTAR FORCE SUITABILITY — Reconnaissance, sensor calibration, optical analysis, and navigation.\n\nCULTURAL NOTES — Arvexorin culture values clarity, perception, and the beauty of refracted light. Rituals involve phase shift ceremonies. Their art emphasizes symmetry and optical illusion.",
    accent: "#34D399",
    icon: "eye",
    order: 74,
  },
  {
    name: "Sylvarith",
    slug: "sylvarith",
    category: "species",
    description:
      "Homeworld: Sylvarithos. Environment: Dense arboreal world with photosynthetic canopy networks. Primary Ability: Photosynthetic metabolic augmentation.\n\nPHYSIOLOGY — Sylvarith possess dermal layers embedded with photosynthetic organelles that supplement metabolic energy. Their skin shifts in hue depending on light exposure. Sylvarith musculature is lightweight and optimized for movement through dense canopy networks.\n\nENVIRONMENTAL ADAPTATION — Sylvarithos’s arboreal ecosystems rely on dense canopy networks that filter sunlight. Early Sylvarith evolved photosynthetic augmentation to survive periods of limited food availability.\n\nMIGRATION PATTERN — Sylvarith thrive in ecological colonies, botanical research stations, and environments requiring environmental harmony.\n\nSTAR FORCE SUITABILITY — Reconnaissance, environmental analysis, stealth operations, and long range scouting.\n\nCULTURAL NOTES — Sylvarith culture values growth, harmony, and connection to natural cycles. Rituals involve sun gathering ceremonies. Their art emphasizes organic shapes and vibrant colors.",
    accent: "#4ADE80",
    icon: "sun",
    order: 75,
  },
];
