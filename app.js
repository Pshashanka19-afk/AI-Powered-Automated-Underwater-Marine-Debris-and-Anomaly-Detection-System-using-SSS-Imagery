/**
 * QORVIA - Planetary Marine Debris & Ghost Net Detection Platform
 * Global Multi-Ocean Engine, Live API Integrations & Zoom-Reactive Risk Rings
 */

// Global State
const appState = {
  theme: 'dark',
  basemapMode: 'dark', // 'dark' or 'satellite' (now just a CSS theme swap, no tiles)
  magnifierActive: false,
  mapReady: false,
  mapEngine: { scale: 1, panX: 0, panY: 0, baseW: 0, baseH: 0 }, // self-built map viewport state
  markerEls: [],     // marker DOM elements currently on the map
  heatEls: [],       // always-visible translucent heat-blob DOM elements
  ringEls: [],        // zoom-triggered concentric danger ring DOM elements
  visibleAnomalies: [],
  activeTarget: null,
  uploadedFile: null,
  uploadedImageDataUrl: null,
  isProcessing: false,
  lastMoveEndFetch: 0,
  filters: {
    regions: ['PAC', 'ATL', 'IND', 'ARC', 'SOU', 'MED'],
    objects: ['debris', 'ghostnet', 'misc'],
    risks: ['high', 'med', 'low']
  },
  settings: {
    threshold: 80,
    sound: true,
    geminiApiKey: localStorage.getItem('qorvia_api_key') || ''
  }
};

// Map scale at/above which concentric danger rings (and the regional temp
// reading) kick in. Below this, only the flat heat-blob + marker dot show.
// Scale 1 = whole world visible; grows as the user zooms in.
const RING_MIN_SCALE = 3;
const MIN_MAP_SCALE = 1;
const MAX_MAP_SCALE = 60;

// Web Audio API Sound Synthesizer (Zero external dependencies)
const soundFx = {
  ctx: null,
  init() {
    if (!this.ctx && typeof AudioContext !== 'undefined') {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
    }
  },
  playSonarPing() {
    if (!appState.settings.sound) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.6);
    } catch(e){}
  },
  playSuccess() {
    if (!appState.settings.sound) return;
    this.init();
    if (!this.ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + idx * 0.08);
        osc.stop(this.ctx.currentTime + idx * 0.08 + 0.35);
      });
    } catch(e){}
  }
};

// Global Multi-Ocean Anomaly Dataset (Covering All 7 Oceans & Major Seas)
// Indian Ocean / Arabian Sea / Bay of Bengal carries 20 nodes; every other
// ocean sector carries 3-4 nodes.
// Indian Ocean total: 20
let oceanAnomalies = [
  {
    id: 'AS100', name: 'Target #AS100 - Arabian Sea Node 1', type: 'ghostnet', typeName: 'Synthetic Ghost Net Cluster',
    region: 'IND', regionName: 'Arabian Sea (AS)', lat: 14.12, lng: 73.81, depth: '80m',
    risk: 'high', confidence: 94.2, sensor: 'Side-Scan Sonar & Sentinel-2 NIR', size: '387m²', mass: '~154 kg',
    sampleImage: 'assets/satellite_bob_0241.jpg', desc: 'Possible ghost net / Synthetic Debris'
  },
  {
    id: 'AS101', name: 'Target #AS101 - Arabian Sea Node 2', type: 'ghostnet', typeName: 'Synthetic Ghost Net Cluster',
    region: 'IND', regionName: 'Arabian Sea (AS)', lat: 17.95, lng: 68.24, depth: '55m',
    risk: 'high', confidence: 92.1, sensor: 'Side-Scan Sonar & Sentinel-2 NIR', size: '200m²', mass: '~290 kg',
    sampleImage: 'assets/satellite_bob_0241.jpg', desc: 'Nylon trawl net entangled near shelf edge'
  },
  {
    id: 'AS102', name: 'Target #AS102 - Arabian Sea Node 3', type: 'debris', typeName: 'Macro Marine Debris',
    region: 'IND', regionName: 'Arabian Sea (AS)', lat: 12.42, lng: 71.1, depth: '110m',
    risk: 'med', confidence: 77.5, sensor: 'Side-Scan Sonar & Sentinel-2 NIR', size: '131m²', mass: '~794 kg',
    sampleImage: 'assets/satellite_bob_0241.jpg', desc: 'Floating polyethylene container debris'
  },
  {
    id: 'AS103', name: 'Target #AS103 - Arabian Sea Node 4', type: 'ghostnet', typeName: 'Synthetic Ghost Net Cluster',
    region: 'IND', regionName: 'Arabian Sea (AS)', lat: 20.11, lng: 66.5, depth: '130m',
    risk: 'high', confidence: 89.4, sensor: 'Side-Scan Sonar & Sentinel-2 NIR', size: '406m²', mass: '~798 kg',
    sampleImage: 'assets/drone_coastal_survey.jpg', desc: 'Deep-set longline gear drifting northwest'
  },
  {
    id: 'AS104', name: 'Target #AS104 - Arabian Sea Node 5', type: 'misc', typeName: 'Miscellaneous Hazard',
    region: 'IND', regionName: 'Arabian Sea (AS)', lat: 10.83, lng: 72.9, depth: '40m',
    risk: 'low', confidence: 58.2, sensor: 'Side-Scan Sonar & Sentinel-2 NIR', size: '104m²', mass: '~644 kg',
    sampleImage: 'assets/sonar_arabian_scan.jpg', desc: 'Minor aquaculture rope fragments'
  },
  {
    id: 'AS105', name: 'Target #AS105 - Arabian Sea Node 6', type: 'debris', typeName: 'Macro Marine Debris',
    region: 'IND', regionName: 'Arabian Sea (AS)', lat: 16.27, lng: 70.4, depth: '95m',
    risk: 'med', confidence: 73.0, sensor: 'Side-Scan Sonar & Sentinel-2 NIR', size: '76m²', mass: '~70 kg',
    sampleImage: 'assets/satellite_bob_0241.jpg', desc: 'Macro-plastic slick near Laccadive shelf'
  },
  {
    id: 'AS106', name: 'Target #AS106 - Arabian Sea Node 7', type: 'ghostnet', typeName: 'Synthetic Ghost Net Cluster',
    region: 'IND', regionName: 'Arabian Sea (AS)', lat: 19.4, lng: 63.8, depth: '150m',
    risk: 'high', confidence: 90.7, sensor: 'Side-Scan Sonar & Sentinel-2 NIR', size: '171m²', mass: '~278 kg',
    sampleImage: 'assets/drone_coastal_survey.jpg', desc: 'Heavy bottom trawl rigging on ridge'
  },
  {
    id: 'AS107', name: 'Target #AS107 - Arabian Sea Node 8', type: 'misc', typeName: 'Miscellaneous Hazard',
    region: 'IND', regionName: 'Arabian Sea (AS)', lat: 9.6, lng: 75.2, depth: '30m',
    risk: 'med', confidence: 68.9, sensor: 'Side-Scan Sonar & Sentinel-2 NIR', size: '368m²', mass: '~67 kg',
    sampleImage: 'assets/drone_coastal_survey.jpg', desc: 'Coastal derelict fishing gear cluster'
  },
  {
    id: 'BOB100', name: 'Target #BOB100 - Bay of Bengal Node 1', type: 'ghostnet', typeName: 'Synthetic Ghost Net Cluster',
    region: 'IND', regionName: 'Bay of Bengal (BOB)', lat: 16.45, lng: 85.92, depth: '65m',
    risk: 'high', confidence: 91.8, sensor: 'Multispectral Optical + Hydroacoustic', size: '161m²', mass: '~773 kg',
    sampleImage: 'assets/drone_coastal_survey.jpg', desc: 'Large abandoned trawl net drifting southward'
  },
  {
    id: 'BOB101', name: 'Target #BOB101 - Bay of Bengal Node 2', type: 'ghostnet', typeName: 'Synthetic Ghost Net Cluster',
    region: 'IND', regionName: 'Bay of Bengal (BOB)', lat: 13.2, lng: 82.5, depth: '100m',
    risk: 'high', confidence: 93.5, sensor: 'Multispectral Optical + Hydroacoustic', size: '419m²', mass: '~598 kg',
    sampleImage: 'assets/sonar_arabian_scan.jpg', desc: 'Dense monofilament net mass near shelf'
  },
  {
    id: 'BOB102', name: 'Target #BOB102 - Bay of Bengal Node 3', type: 'debris', typeName: 'Macro Marine Debris',
    region: 'IND', regionName: 'Bay of Bengal (BOB)', lat: 18.7, lng: 89.1, depth: '50m',
    risk: 'med', confidence: 76.2, sensor: 'Multispectral Optical + Hydroacoustic', size: '172m²', mass: '~499 kg',
    sampleImage: 'assets/drone_coastal_survey.jpg', desc: 'Riverine plastic outflow aggregation'
  },
  {
    id: 'BOB103', name: 'Target #BOB103 - Bay of Bengal Node 4', type: 'ghostnet', typeName: 'Synthetic Ghost Net Cluster',
    region: 'IND', regionName: 'Bay of Bengal (BOB)', lat: 11.5, lng: 81.0, depth: '120m',
    risk: 'high', confidence: 88.0, sensor: 'Multispectral Optical + Hydroacoustic', size: '202m²', mass: '~868 kg',
    sampleImage: 'assets/satellite_bob_0241.jpg', desc: 'Submerged trawl gear on continental slope'
  },
  {
    id: 'BOB104', name: 'Target #BOB104 - Bay of Bengal Node 5', type: 'misc', typeName: 'Miscellaneous Hazard',
    region: 'IND', regionName: 'Bay of Bengal (BOB)', lat: 20.3, lng: 90.4, depth: '35m',
    risk: 'low', confidence: 60.4, sensor: 'Multispectral Optical + Hydroacoustic', size: '141m²', mass: '~754 kg',
    sampleImage: 'assets/sonar_arabian_scan.jpg', desc: 'Coastal aquaculture cage debris'
  },
  {
    id: 'BOB105', name: 'Target #BOB105 - Bay of Bengal Node 6', type: 'debris', typeName: 'Macro Marine Debris',
    region: 'IND', regionName: 'Bay of Bengal (BOB)', lat: 14.8, lng: 87.6, depth: '75m',
    risk: 'med', confidence: 71.3, sensor: 'Multispectral Optical + Hydroacoustic', size: '234m²', mass: '~324 kg',
    sampleImage: 'assets/satellite_bob_0241.jpg', desc: 'Floating industrial foam & crates'
  },
  {
    id: 'BOB106', name: 'Target #BOB106 - Bay of Bengal Node 7', type: 'ghostnet', typeName: 'Synthetic Ghost Net Cluster',
    region: 'IND', regionName: 'Bay of Bengal (BOB)', lat: 8.9, lng: 83.7, depth: '140m',
    risk: 'high', confidence: 90.1, sensor: 'Multispectral Optical + Hydroacoustic', size: '170m²', mass: '~821 kg',
    sampleImage: 'assets/sonar_arabian_scan.jpg', desc: 'Deep pelagic longline hazard zone'
  },
  {
    id: 'BOB107', name: 'Target #BOB107 - Bay of Bengal Node 8', type: 'misc', typeName: 'Miscellaneous Hazard',
    region: 'IND', regionName: 'Bay of Bengal (BOB)', lat: 17.1, lng: 92.4, depth: '45m',
    risk: 'med', confidence: 69.8, sensor: 'Multispectral Optical + Hydroacoustic', size: '112m²', mass: '~134 kg',
    sampleImage: 'assets/sonar_arabian_scan.jpg', desc: 'Derelict crab trap line'
  },
  {
    id: 'IO100', name: 'Target #IO100 - Indian Ocean Node 1', type: 'ghostnet', typeName: 'Synthetic Ghost Net Cluster',
    region: 'IND', regionName: 'Indian Ocean (IO)', lat: 5.8, lng: 79.4, depth: '110m',
    risk: 'high', confidence: 95.0, sensor: 'Autonomous Buoy Hydrophone & Sonar', size: '109m²', mass: '~407 kg',
    sampleImage: 'assets/sonar_arabian_scan.jpg', desc: 'Deep pelagic longline & synthetic mesh'
  },
  {
    id: 'IO101', name: 'Target #IO101 - Indian Ocean Node 2', type: 'debris', typeName: 'Macro Marine Debris',
    region: 'IND', regionName: 'Indian Ocean (IO)', lat: -2.5, lng: 73.0, depth: '90m',
    risk: 'med', confidence: 74.6, sensor: 'Autonomous Buoy Hydrophone & Sonar', size: '369m²', mass: '~310 kg',
    sampleImage: 'assets/satellite_bob_0241.jpg', desc: 'Equatorial gyre convergence debris'
  },
  {
    id: 'IO102', name: 'Target #IO102 - Indian Ocean Node 3', type: 'ghostnet', typeName: 'Synthetic Ghost Net Cluster',
    region: 'IND', regionName: 'Indian Ocean (IO)', lat: 2.1, lng: 88.5, depth: '160m',
    risk: 'high', confidence: 87.3, sensor: 'Autonomous Buoy Hydrophone & Sonar', size: '295m²', mass: '~589 kg',
    sampleImage: 'assets/satellite_bob_0241.jpg', desc: 'Derelict fish aggregating device cluster'
  },
  {
    id: 'IO103', name: 'Target #IO103 - Indian Ocean Node 4', type: 'misc', typeName: 'Miscellaneous Hazard',
    region: 'IND', regionName: 'Indian Ocean (IO)', lat: -6.4, lng: 66.0, depth: '70m',
    risk: 'low', confidence: 55.0, sensor: 'Autonomous Buoy Hydrophone & Sonar', size: '253m²', mass: '~120 kg',
    sampleImage: 'assets/drone_coastal_survey.jpg', desc: 'Scattered synthetic floats'
  },
  {
    id: 'P0101', name: 'Target #P0101 - Great Pacific Garbage Patch (GPGP) Core', type: 'ghostnet', typeName: 'Mega-Cluster Polyamide Trawl & Fish FADs',
    region: 'PAC', regionName: 'North Pacific Gyre (GPGP)', lat: 32.45, lng: -145.2, depth: '25m',
    risk: 'high', confidence: 96.8, sensor: 'Sentinel-2 SWIR & NOAA Ocean Buoy 46006', size: '850m²', mass: '~1,450 kg',
    sampleImage: 'assets/sonar_arabian_scan.jpg', desc: 'Dense converging gyre debris zone containing multi-ton entangled synthetic netting.'
  },
  {
    id: 'P0102', name: 'Target #P0102 - Kuroshio Extension Longlines', type: 'ghostnet', typeName: 'Pelagic Synthetic Longline Array',
    region: 'PAC', regionName: 'Western Pacific (Kuroshio)', lat: 28.5, lng: 142.3, depth: '95m',
    risk: 'high', confidence: 92.4, sensor: 'Acoustic Hydrophone Array & SAR', size: '340m²', mass: '~380 kg',
    sampleImage: 'assets/drone_coastal_survey.jpg', desc: 'Submerged commercial longlines drifting east along high-velocity Kuroshio current.'
  },
  {
    id: 'P0103', name: 'Target #P0103 - South Pacific Macro-Plastic Slick', type: 'debris', typeName: 'Floating Industrial Polyethylene Crates',
    region: 'PAC', regionName: 'South Pacific Gyre', lat: -28.1, lng: -110.4, depth: '15m',
    risk: 'med', confidence: 75.0, sensor: 'MODIS Ocean Color Spectral Imagery', size: '120m²', mass: '~90 kg',
    sampleImage: 'assets/drone_coastal_survey.jpg', desc: 'Aggregated macro-plastics and polypropylene float fragments.'
  },
  {
    id: 'P0104', name: 'Target #P0104 - Sea of Japan Coastal Net', type: 'ghostnet', typeName: 'Coastal Gillnet Entanglement',
    region: 'PAC', regionName: 'North Pacific (Sea of Japan)', lat: 39.2, lng: 133.8, depth: '60m',
    risk: 'med', confidence: 79.5, sensor: 'Coastal UAV Multispectral Camera', size: '150m²', mass: '~130 kg',
    sampleImage: 'assets/sonar_arabian_scan.jpg', desc: 'Nearshore gillnet drifting toward fishing lanes.'
  },
  {
    id: 'A0201', name: 'Target #A0201 - Sargasso Sea Entanglement Zone', type: 'ghostnet', typeName: 'Nylon Gillnet Trapped in Sargassum Mat',
    region: 'ATL', regionName: 'North Atlantic (Sargasso Sea)', lat: 28.5, lng: -65.0, depth: '35m',
    risk: 'high', confidence: 94.5, sensor: ' MSI Red-Edge Band', size: '420m²', mass: '~520 kg',
    sampleImage: 'assets/drone_coastal_survey.jpg', desc: 'Derelict commercial netting interwoven into pelagic sargassum weed habitat.'
  },
  {
    id: 'A0202', name: 'Target #A0202 - Mid-Atlantic Deep Ridge Net', type: 'ghostnet', typeName: 'Deep-Water Bottom Trawl Rigging',
    region: 'ATL', regionName: 'Mid-Atlantic Ridge', lat: 34.2, lng: -40.5, depth: '140m',
    risk: 'high', confidence: 91.0, sensor: 'Bathymetric Multibeam Sonar', size: '280m²', mass: '~410 kg',
    sampleImage: 'assets/satellite_bob_0241.jpg', desc: 'Heavy weighted ground-gear pinned against hydrothermal vent ridge.'
  },
  {
    id: 'A0203', name: 'Target #A0203 - South Atlantic Abandoned Traps', type: 'misc', typeName: 'Derelict Crab & Lobster Trap Line',
    region: 'ATL', regionName: 'South Atlantic Basin', lat: -25.4, lng: -15.2, depth: '75m',
    risk: 'med', confidence: 78.2, sensor: 'Satellite Radar SAR + Sonar', size: '95m²', mass: '~180 kg',
    sampleImage: 'assets/drone_coastal_survey.jpg', desc: 'Continuous line of metallic and nylon traps drifting off South American continental slope.'
  },
  {
    id: 'A0204', name: 'Target #A0204 - Gulf of Guinea Slick', type: 'debris', typeName: 'Floating Oilfield Debris Aggregation',
    region: 'ATL', regionName: 'East Atlantic (Gulf of Guinea)', lat: 2.3, lng: 4.1, depth: '20m',
    risk: 'low', confidence: 61.0, sensor: 'Sentinel-1 SAR', size: '70m²', mass: '~55 kg',
    sampleImage: 'assets/satellite_bob_0241.jpg', desc: 'Scattered industrial debris near offshore platforms.'
  },
  {
    id: 'AR0401', name: 'Target #AR0401 - Barents Sea Ice-Edge Net', type: 'ghostnet', typeName: 'Heavy High-Latitude Polypropylene Trawl',
    region: 'ARC', regionName: 'Arctic Ocean (Barents Sea)', lat: 74.8, lng: 35.2, depth: '180m',
    risk: 'high', confidence: 93.0, sensor: 'CryoSat-2 Radar & Polar Sonar Buoy', size: '480m²', mass: '~780 kg',
    sampleImage: 'assets/satellite_bob_0241.jpg', desc: 'Massive polar trawl gear entangled around seabed moraine near sea ice margin.'
  },
  {
    id: 'AR0402', name: 'Target #AR0402 - Fram Strait Derelict Lines', type: 'debris', typeName: 'Braided Mooring Lines & Synthetic Floats',
    region: 'ARC', regionName: 'Arctic Ocean (Fram Strait)', lat: 78.5, lng: -2.1, depth: '40m',
    risk: 'med', confidence: 81.0, sensor: 'Sentinel-1 C-Band SAR', size: '110m²', mass: '~160 kg',
    sampleImage: 'assets/drone_coastal_survey.jpg', desc: 'Floating Arctic expedition and fishing mooring debris trapped in pack ice.'
  },
  {
    id: 'AR0403', name: 'Target #AR0403 - Chukchi Sea Ghost Gear', type: 'ghostnet', typeName: 'Drifting Crab Pot Line',
    region: 'ARC', regionName: 'Arctic Ocean (Chukchi Sea)', lat: 70.1, lng: -165.3, depth: '60m',
    risk: 'med', confidence: 72.4, sensor: 'Polar-orbit SAR Satellite', size: '140m²', mass: '~190 kg',
    sampleImage: 'assets/satellite_bob_0241.jpg', desc: 'Abandoned crab pot line drifting with seasonal ice melt.'
  },
  {
    id: 'SO0501', name: 'Target #SO0501 - Drake Passage High-Drift Net', type: 'ghostnet', typeName: 'Circumpolar Pelagic Longline Mass',
    region: 'SOU', regionName: 'Southern Ocean (Drake Passage)', lat: -58.4, lng: -65.1, depth: '140m',
    risk: 'high', confidence: 95.5, sensor: 'Autonomous Wave Glider Telemetry', size: '520m²', mass: '~890 kg',
    sampleImage: 'assets/sonar_arabian_scan.jpg', desc: 'High-speed Antarctic circumpolar drift longline hazard for albatrosses and cetaceans.'
  },
  {
    id: 'SO0502', name: 'Target #SO0502 - Weddell Sea Subsurface Hazard', type: 'misc', typeName: 'Abandoned Deep-Set Crab Traps',
    region: 'SOU', regionName: 'Southern Ocean (Weddell Sea)', lat: -62.3, lng: -30.4, depth: '90m',
    risk: 'med', confidence: 84.0, sensor: 'Hydroacoustic Acoustic Echo Sensor', size: '140m²', mass: '~260 kg',
    sampleImage: 'assets/satellite_bob_0241.jpg', desc: 'Subsurface synthetic line and cages drifting near Antarctic shelf boundary.'
  },
  {
    id: 'SO0503', name: 'Target #SO0503 - Ross Sea Trawl Remnant', type: 'ghostnet', typeName: 'Remnant Bottom Trawl Netting',
    region: 'SOU', regionName: 'Southern Ocean (Ross Sea)', lat: -72.1, lng: 175.6, depth: '110m',
    risk: 'high', confidence: 88.6, sensor: 'Multibeam Bathymetric Sonar', size: '300m²', mass: '~410 kg',
    sampleImage: 'assets/satellite_bob_0241.jpg', desc: 'Historic trawl remnant snagged on seamount ledge.'
  },
  {
    id: 'M0601', name: 'Target #M0601 - Ligurian Pelagic Sanctuary Net', type: 'ghostnet', typeName: 'Submerged Monofilament Nylon Net',
    region: 'MED', regionName: 'Mediterranean (Ligurian Sea)', lat: 43.5, lng: 8.5, depth: '55m',
    risk: 'high', confidence: 88.0, sensor: 'Coastal UAV Multispectral Camera', size: '190m²', mass: '~150 kg',
    sampleImage: 'assets/satellite_bob_0241.jpg', desc: 'Monofilament net threatening marine mammals in the Pelagos Cetacean Sanctuary.'
  },
  {
    id: 'M0602', name: 'Target #M0602 - Aegean Coastal Flotsam', type: 'debris', typeName: 'Polypropylene Aquaculture Ropes',
    region: 'MED', regionName: 'Mediterranean (Aegean Sea)', lat: 37.5, lng: 25.5, depth: '30m',
    risk: 'low', confidence: 62.0, sensor: 'Sentinel-2 RGB Coastal Survey', size: '65m²', mass: '~45 kg',
    sampleImage: 'assets/sonar_arabian_scan.jpg', desc: 'Escaped fish farm cage mesh and synthetic mooring lines.'
  },
  {
    id: 'M0603', name: 'Target #M0603 - Tyrrhenian Deep Net Snag', type: 'ghostnet', typeName: 'Snagged Trawl Net on Reef',
    region: 'MED', regionName: 'Mediterranean (Tyrrhenian Sea)', lat: 40.1, lng: 12.4, depth: '70m',
    risk: 'med', confidence: 74.9, sensor: 'Side-Scan Sonar', size: '100m²', mass: '~120 kg',
    sampleImage: 'assets/sonar_arabian_scan.jpg', desc: 'Net fragment snagged on rocky reef, entangling reef fauna.'
  }
];

// Document Ready Initialization
document.addEventListener('DOMContentLoaded', () => {
  initSplashScreen();
  initMap();
  initFilters();
  initMagnifier();
  initUploadPipeline();
  initHamburgerMenu();
  initTelemetryModal();
  initDrawings();
  initDemoTour();
  initBboxInteractions();
  initApiManager();

  // Set default active target
  selectTarget(oceanAnomalies[0]);
  fetchLiveMarineData(oceanAnomalies[0].lat, oceanAnomalies[0].lng);
});

/* ==========================================================================
   1. SPLASH SCREEN INTRO SEQUENCE
   Wireframe requirement: logo alone for 2s, then the tagline "for the next
   generation" fades in directly beneath QORVIA, left-aligned so the word
   starts exactly under the "R" of QORVIA.
   ========================================================================== */
function alignTaglineToR() {
  const rAnchor = document.getElementById('letter-r-anchor');
  const container = document.getElementById('splash-title-container');
  const tagline = document.getElementById('splash-tagline');
  if (!rAnchor || !container || !tagline) return;
  const rRect = rAnchor.getBoundingClientRect();
  const cRect = container.getBoundingClientRect();
  tagline.style.left = `${rRect.left - cRect.left}px`;
}

function initSplashScreen() {
  const splashScreen = document.getElementById('splash-screen');
  const splashProgress = document.getElementById('splash-progress');
  const tagline = document.getElementById('splash-tagline');
  const btnSkip = document.getElementById('btn-skip-splash');
  const btnReplay = document.getElementById('btn-replay-splash');

  let splashTimer = null;
  let progressInterval = null;

  function runSequence() {
    splashScreen.style.display = 'flex';
    splashScreen.style.opacity = '1';
    splashScreen.style.visibility = 'visible';

    tagline.classList.remove('visible');
    alignTaglineToR();
    splashProgress.style.width = '0%';

    let progress = 0;
    progressInterval = setInterval(() => {
      progress += 2.2;
      if (progress <= 100) splashProgress.style.width = `${progress}%`;
    }, 100);

    // Logo appears alone for exactly 2 seconds, then the tagline reveals.
    setTimeout(() => {
      alignTaglineToR();
      tagline.classList.add('visible');
      soundFx.playSonarPing();
    }, 2000);

    splashTimer = setTimeout(() => {
      dismissSplash();
    }, 4600);
  }

  function dismissSplash() {
    clearInterval(progressInterval);
    clearTimeout(splashTimer);
    splashProgress.style.width = '100%';
    splashScreen.style.opacity = '0';
    setTimeout(() => {
      splashScreen.style.visibility = 'hidden';
      splashScreen.style.display = 'none';
      if (appState.mapReady) layoutMap();
    }, 800);
  }

  btnSkip.addEventListener('click', dismissSplash);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') dismissSplash(); });
  window.addEventListener('resize', () => { if (splashScreen.style.display !== 'none') alignTaglineToR(); });

  if (btnReplay) {
    btnReplay.addEventListener('click', () => { closeHamburger(); runSequence(); });
  }

  runSequence();
}

/* ==========================================================================
   2. SELF-CONTAINED OCEAN MAP ENGINE
   No external map library (Leaflet/Mapbox/etc.) and NO tile-server requests
   of any kind — everything is drawn from plain SVG + CSS + JS, so it renders
   identically regardless of network restrictions, firewalls, or ad-blockers.
   Pan = drag, Zoom = wheel / +− buttons / region-jump buttons.
   ========================================================================== */

// Rough simplified continent outlines as [lat, lng] point lists — stylized,
// not survey-accurate, just enough to read as a world map at a glance.
const CONTINENT_SHAPES = [
  { name: 'north-america', points: [
    [71,-156],[70,-141],[60,-140],[55,-130],[48,-125],[40,-124],[32,-117],[23,-109],
    [20,-105],[16,-95],[9,-83],[8,-77],[11,-72],[18,-88],[21,-97],[29,-95],[30,-89],
    [25,-80],[31,-81],[36,-76],[40,-74],[44,-67],[47,-60],[52,-56],[58,-62],[60,-65],
    [63,-68],[70,-75],[73,-90],[70,-100],[68,-110],[70,-130],[71,-156]
  ]},
  { name: 'south-america', points: [
    [11,-72],[8,-77],[1,-79],[-4,-81],[-14,-76],[-18,-70],[-23,-70],[-33,-72],
    [-42,-73],[-52,-73],[-55,-68],[-52,-64],[-38,-58],[-34,-54],[-23,-43],[-13,-38],
    [-5,-35],[2,-50],[5,-60],[8,-62],[11,-72]
  ]},
  { name: 'africa', points: [
    [37,10],[33,-8],[27,-16],[15,-17],[7,-13],[5,-4],[4,9],[-1,9],[-6,12],[-15,12],
    [-22,14],[-28,16],[-34,19],[-34,25],[-29,31],[-25,33],[-20,35],[-10,40],[0,42],
    [5,48],[11,51],[15,42],[22,37],[27,34],[31,32],[32,25],[31,22],[31,10],[37,10]
  ]},
  { name: 'eurasia', points: [
    [36,-9],[43,-9],[48,-2],[51,2],[53,8],[55,10],[58,10],[60,20],[66,25],[70,25],
    [70,40],[68,60],[70,70],[73,90],[75,110],[73,140],[65,170],[60,160],[55,163],
    [52,158],[45,140],[40,140],[35,128],[31,121],[23,113],[15,108],[10,105],[8,98],
    [13,93],[20,90],[22,88],[15,80],[8,77],[9,79],[18,73],[24,68],[25,61],[27,55],
    [30,48],[29,34],[36,36],[41,29],[42,20],[40,20],[38,15],[36,-9]
  ]},
  { name: 'australia', points: [
    [-11,131],[-12,136],[-15,140],[-17,146],[-20,149],[-25,153],[-31,153],[-35,150],
    [-38,145],[-39,142],[-35,138],[-33,134],[-32,128],[-31,116],[-25,113],[-20,114],
    [-16,123],[-14,126],[-11,131]
  ]},
  { name: 'antarctica', points: [
    [-63,-180],[-63,-90],[-63,0],[-63,90],[-63,180],[-90,180],[-90,-180],[-63,-180]
  ]},
  { name: 'greenland', points: [
    [83,-35],[77,-20],[70,-25],[61,-46],[65,-53],[72,-56],[78,-65],[83,-35]
  ]}
];

// Fixed projection space used only for the background SVG (continents +
// graticule). It always fills the map box exactly since #map-world is kept
// at a locked 2:1 aspect ratio, so this never needs to know real pixel size.
const VB_W = 2000, VB_H = 1000;
function projectViewBox(lat, lng) {
  return { x: (lng + 180) / 360 * VB_W, y: (90 - lat) / 180 * VB_H };
}

// Dynamic projection used for markers/rings/labels — depends on the ocean-map
// viewport's actual current width (recomputed on init + resize).
function projectPx(lat, lng) {
  const w = appState.mapEngine.baseW, h = appState.mapEngine.baseH;
  return { x: (lng + 180) / 360 * w, y: (90 - lat) / 180 * h };
}

function computeGlobalAvgTemp() {
  let sum = 0;
  oceanAnomalies.forEach(a => { sum += (29.0 - Math.abs(a.lat) * 0.35); });
  return sum / oceanAnomalies.length;
}

function pathFromPoints(points) {
  return points.map((p, i) => {
    const { x, y } = projectViewBox(p[0], p[1]);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ') + ' Z';
}

function buildWorldSVG() {
  let paths = CONTINENT_SHAPES.map(c => `<path class="qorvia-continent" d="${pathFromPoints(c.points)}" />`).join('');
  let grid = '';
  for (let lng = -180; lng <= 180; lng += 30) {
    const x = projectViewBox(0, lng).x;
    grid += `<line class="qorvia-graticule" x1="${x}" y1="0" x2="${x}" y2="${VB_H}" />`;
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = projectViewBox(lat, 0).y;
    grid += `<line class="qorvia-graticule" x1="0" y1="${y}" x2="${VB_W}" y2="${y}" />`;
  }
  return `<svg class="qorvia-world-svg" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="none"
            style="position:absolute;inset:0;width:100%;height:100%;">${grid}${paths}</svg>`;
}

const OCEAN_LABELS = [
  { name: 'PACIFIC OCEAN (GPGP)', lat: 30.0, lng: -145.0 },
  { name: 'NORTH ATLANTIC (SARGASSO)', lat: 30.0, lng: -55.0 },
  { name: 'SOUTH ATLANTIC GYRE', lat: -25.0, lng: -20.0 },
  { name: 'INDIAN OCEAN (AS / BOB)', lat: 10.0, lng: 75.0 },
  { name: 'ARCTIC OCEAN (POLAR)', lat: 75.0, lng: 20.0 },
  { name: 'SOUTHERN OCEAN (DRAKE)', lat: -58.0, lng: -60.0 },
  { name: 'MEDITERRANEAN SEA', lat: 36.0, lng: 18.0 }
];

let mapViewportEl = null;
let mapWorldEl = null;
let isDragging = false, dragMoved = false;
let dragStartX = 0, dragStartY = 0, dragStartPanX = 0, dragStartPanY = 0;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function applyMapTransform() {
  const me = appState.mapEngine;
  mapWorldEl.style.transform = `translate(${me.panX}px, ${me.panY}px) scale(${me.scale})`;
}

function screenToWorldPx(sx, sy) {
  const me = appState.mapEngine;
  return { lx: (sx - me.panX) / me.scale, ly: (sy - me.panY) / me.scale };
}

function screenToLatLng(sx, sy) {
  const me = appState.mapEngine;
  const { lx, ly } = screenToWorldPx(sx, sy);
  const lng = (lx / me.baseW) * 360 - 180;
  const lat = 90 - (ly / me.baseH) * 180;
  return { lat, lng };
}

function updateCoordHUD(lat, lng) {
  const latElem = document.getElementById('coord-lat');
  const lngElem = document.getElementById('coord-lng');
  if (latElem) latElem.textContent = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
  if (lngElem) lngElem.textContent = `${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`;
}

function initMap() {
  mapViewportEl = document.getElementById('ocean-map');
  if (!mapViewportEl) return;

  mapViewportEl.innerHTML = `
    <div class="qorvia-map-bg"></div>
    <div id="map-world" class="qorvia-map-world"></div>
  `;
  mapWorldEl = document.getElementById('map-world');

  layoutMap(true);
  appState.mapReady = true;

  // --- Drag to pan ---
  mapViewportEl.addEventListener('mousedown', (e) => {
    isDragging = true; dragMoved = false;
    dragStartX = e.clientX; dragStartY = e.clientY;
    dragStartPanX = appState.mapEngine.panX; dragStartPanY = appState.mapEngine.panY;
    mapViewportEl.classList.add('qorvia-dragging');
  });
  window.addEventListener('mousemove', (e) => {
    const rect = mapViewportEl.getBoundingClientRect();
    if (isDragging) {
      const dx = e.clientX - dragStartX, dy = e.clientY - dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
      appState.mapEngine.panX = dragStartPanX + dx;
      appState.mapEngine.panY = dragStartPanY + dy;
      applyMapTransform();
    }
    if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
      const { lat, lng } = screenToLatLng(e.clientX - rect.left, e.clientY - rect.top);
      updateCoordHUD(lat, lng);
    }
  });
  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    mapViewportEl.classList.remove('qorvia-dragging');
  });

  // Touch support (basic drag)
  mapViewportEl.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    isDragging = true; dragMoved = false;
    dragStartX = t.clientX; dragStartY = t.clientY;
    dragStartPanX = appState.mapEngine.panX; dragStartPanY = appState.mapEngine.panY;
  }, { passive: true });
  mapViewportEl.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const t = e.touches[0];
    const dx = t.clientX - dragStartX, dy = t.clientY - dragStartY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
    appState.mapEngine.panX = dragStartPanX + dx;
    appState.mapEngine.panY = dragStartPanY + dy;
    applyMapTransform();
  }, { passive: true });
  window.addEventListener('touchend', () => { isDragging = false; });

  // --- Click on empty water = fetch telemetry at that point ---
  mapViewportEl.addEventListener('click', (e) => {
    if (dragMoved) { dragMoved = false; return; }
    if (e.target.closest('.qorvia-marker')) return; // marker handles its own click
    const rect = mapViewportEl.getBoundingClientRect();
    const { lat, lng } = screenToLatLng(e.clientX - rect.left, e.clientY - rect.top);
    soundFx.playSonarPing();
    fetchLiveMarineData(lat, lng);
  });

  // --- Wheel to zoom (centered on cursor) ---
  mapViewportEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = mapViewportEl.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    zoomAt(sx, sy, e.deltaY < 0 ? 1.25 : 0.8);
  }, { passive: false });

  // --- Zoom buttons ---
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  if (btnZoomIn) btnZoomIn.addEventListener('click', () => {
    soundFx.playSonarPing();
    zoomAt(mapViewportEl.clientWidth / 2, mapViewportEl.clientHeight / 2, 1.5);
  });
  if (btnZoomOut) btnZoomOut.addEventListener('click', () => {
    soundFx.playSonarPing();
    zoomAt(mapViewportEl.clientWidth / 2, mapViewportEl.clientHeight / 2, 1 / 1.5);
  });

  // --- Region jump buttons ---
  document.querySelectorAll('.btn-region-jump').forEach(btn => {
    btn.addEventListener('click', () => {
      soundFx.playSonarPing();
      const lat = parseFloat(btn.dataset.lat);
      const lng = parseFloat(btn.dataset.lng);
      const targetScale = parseFloat(btn.dataset.scale);
      flyTo(lat, lng, targetScale);
      fetchLiveMarineData(lat, lng);
    });
  });

  // --- "Satellite Theme" toggle (pure CSS palette swap, no tiles involved) ---
  const btnToggleBasemap = document.getElementById('btn-toggle-basemap');
  const basemapText = document.getElementById('basemap-text');
  if (btnToggleBasemap) {
    btnToggleBasemap.addEventListener('click', () => {
      soundFx.playSonarPing();
      if (appState.basemapMode === 'dark') {
        appState.basemapMode = 'satellite';
        mapViewportEl.classList.add('satellite-theme-on');
        basemapText.textContent = 'Satellite Theme: ON';
        btnToggleBasemap.classList.add('bg-cyan-900/60', 'border-cyan-400');
      } else {
        appState.basemapMode = 'dark';
        mapViewportEl.classList.remove('satellite-theme-on');
        basemapText.textContent = 'Satellite Theme: OFF';
        btnToggleBasemap.classList.remove('bg-cyan-900/60', 'border-cyan-400');
      }
    });
  }

  window.addEventListener('resize', () => { layoutMap(false); });

  renderMapAnomalies();
  updateZoomDependentTemp();
}

// (Re)computes the map's pixel dimensions and rebuilds the background layer.
// keepView=false preserves the current pan/zoom across a resize; true resets
// to the default whole-world view (used on first load).
function layoutMap(resetView) {
  if (!mapViewportEl || !mapWorldEl) return;
  const rect = mapViewportEl.getBoundingClientRect();
  const w = Math.max(1, rect.width);
  const h = Math.max(1, w / 2); // fixed 2:1 equirectangular aspect

  appState.mapEngine.baseW = w;
  appState.mapEngine.baseH = h;
  mapWorldEl.style.width = `${w}px`;
  mapWorldEl.style.height = `${h}px`;
  mapWorldEl.innerHTML = buildWorldSVG();

  if (resetView) {
    appState.mapEngine.scale = 1;
    appState.mapEngine.panX = 0;
    appState.mapEngine.panY = (rect.height - h) / 2;
  }
  applyMapTransform();

  renderOceanLabels();
  if (appState.mapReady) {
    renderMapAnomalies();
  }
}

function renderOceanLabels() {
  document.querySelectorAll('.qorvia-ocean-label').forEach(el => el.remove());
  OCEAN_LABELS.forEach(reg => {
    const { x, y } = projectPx(reg.lat, reg.lng);
    const el = document.createElement('div');
    el.className = 'qorvia-ocean-label';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.textContent = reg.name;
    mapWorldEl.appendChild(el);
  });
}

function zoomAt(sx, sy, factor) {
  const me = appState.mapEngine;
  const { lx, ly } = screenToWorldPx(sx, sy);
  const newScale = clamp(me.scale * factor, MIN_MAP_SCALE, MAX_MAP_SCALE);
  me.panX = sx - lx * newScale;
  me.panY = sy - ly * newScale;
  me.scale = newScale;
  applyMapTransform();
  onZoomChanged();
}

function flyTo(lat, lng, targetScale) {
  const me = appState.mapEngine;
  const rect = mapViewportEl.getBoundingClientRect();
  const { x, y } = projectPx(lat, lng);
  const newScale = clamp(targetScale, MIN_MAP_SCALE, MAX_MAP_SCALE);
  const targetPanX = rect.width / 2 - x * newScale;
  const targetPanY = rect.height / 2 - y * newScale;

  mapWorldEl.classList.add('animated-fly');
  me.scale = newScale; me.panX = targetPanX; me.panY = targetPanY;
  applyMapTransform();
  setTimeout(() => { mapWorldEl.classList.remove('animated-fly'); onZoomChanged(); }, 1300);
}

function onZoomChanged() {
  updateMarkerCounterScale();
  refreshRiskRings();
  updateZoomDependentTemp();
}

function updateMarkerCounterScale() {
  const inv = 1 / appState.mapEngine.scale;
  appState.markerEls.forEach(m => {
    m.style.transform = `translate(-50%, -50%) scale(${inv})`;
  });
  document.querySelectorAll('.qorvia-ocean-label').forEach(el => {
    el.style.transform = `translate(-50%, -50%) scale(${inv})`;
  });
}

/* Ocean temperature HUD: global multi-ocean average while zoomed out,
   switches to a region-specific reading once past RING_MIN_SCALE. */
function updateZoomDependentTemp() {
  const tempElem = document.getElementById('live-temp');
  if (!tempElem || !mapViewportEl) return;
  const scale = appState.mapEngine.scale;
  if (scale < RING_MIN_SCALE) {
    tempElem.textContent = `${computeGlobalAvgTemp().toFixed(1)}°C (Global)`;
  } else {
    const rect = mapViewportEl.getBoundingClientRect();
    const { lat } = screenToLatLng(rect.width / 2, rect.height / 2);
    const regional = (29.0 - Math.abs(lat) * 0.35).toFixed(1);
    tempElem.textContent = `${regional}°C (Regional)`;
  }
}

function clearRiskRings() {
  appState.ringEls.forEach(el => el.remove());
  appState.ringEls = [];
}

// Draws N concentric "danger" rings around a high/med/low risk target.
// Ring count: high = 4, medium = 3, low = 2. Rings are NOT counter-scaled,
// so they visibly grow bigger the further the user zooms in.
function drawRiskRings(anomaly, riskColor) {
  const scale = appState.mapEngine.scale;
  const ringCounts = { high: 4, med: 3, low: 2 };
  const count = ringCounts[anomaly.risk] || 2;
  const zoomFactor = 1 + (scale - RING_MIN_SCALE) * 0.35;
  const baseDiameterPx = (anomaly.risk === 'high' ? 34 : anomaly.risk === 'med' ? 26 : 18) * zoomFactor;
  const { x, y } = projectPx(anomaly.lat, anomaly.lng);

  for (let i = 1; i <= count; i++) {
    const d = baseDiameterPx * i * 0.9;
    const ring = document.createElement('div');
    ring.className = 'qorvia-ring';
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    ring.style.width = `${d}px`;
    ring.style.height = `${d}px`;
    ring.style.marginLeft = `${-d / 2}px`;
    ring.style.marginTop = `${-d / 2}px`;
    ring.style.borderColor = riskColor;
    ring.style.borderWidth = '1.6px';
    ring.style.opacity = Math.max(0.2, 0.9 - i * 0.14);
    mapWorldEl.appendChild(ring);
    appState.ringEls.push(ring);
  }
}

function refreshRiskRings() {
  clearRiskRings();
  if (appState.mapEngine.scale < RING_MIN_SCALE) return; // only once zoomed in
  (appState.visibleAnomalies || []).forEach(anomaly => {
    const riskColor = anomaly.risk === 'high' ? '#ef4444' : anomaly.risk === 'med' ? '#f59e0b' : '#10b981';
    drawRiskRings(anomaly, riskColor);
  });
}

function renderMapAnomalies() {
  if (!mapWorldEl) return;

  appState.markerEls.forEach(m => m.remove());
  appState.heatEls.forEach(h => h.remove());
  appState.markerEls = [];
  appState.heatEls = [];
  clearRiskRings();

  const visibleAnomalies = oceanAnomalies.filter(item => {
    const matchRegion = appState.filters.regions.includes(item.region);
    const matchObject = appState.filters.objects.includes(item.type);
    const matchRisk = appState.filters.risks.includes(item.risk);
    const matchThreshold = item.confidence >= (appState.settings.threshold - 40);
    return matchRegion && matchObject && matchRisk && matchThreshold;
  });
  appState.visibleAnomalies = visibleAnomalies;

  const inv = 1 / appState.mapEngine.scale;

  visibleAnomalies.forEach(anomaly => {
    let riskColor = '#10b981';
    if (anomaly.risk === 'high') riskColor = '#ef4444';
    else if (anomaly.risk === 'med') riskColor = '#f59e0b';

    const { x, y } = projectPx(anomaly.lat, anomaly.lng);

    // Always-visible translucent heat blob (grows with zoom, like the rings)
    const heatDiameter = anomaly.risk === 'high' ? 60 : 40;
    const heat = document.createElement('div');
    heat.className = 'qorvia-ring';
    heat.style.animation = 'none';
    heat.style.left = `${x}px`;
    heat.style.top = `${y}px`;
    heat.style.width = `${heatDiameter}px`;
    heat.style.height = `${heatDiameter}px`;
    heat.style.marginLeft = `${-heatDiameter / 2}px`;
    heat.style.marginTop = `${-heatDiameter / 2}px`;
    heat.style.borderWidth = '1px';
    heat.style.borderColor = riskColor;
    heat.style.background = riskColor;
    heat.style.opacity = anomaly.risk === 'high' ? '0.28' : '0.16';
    mapWorldEl.appendChild(heat);
    appState.heatEls.push(heat);

    // Marker dot with hover tooltip
    const marker = document.createElement('div');
    marker.className = 'qorvia-marker';
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    marker.style.transform = `translate(-50%, -50%) scale(${inv})`;
    marker.innerHTML = `
      <div class="dot" style="background:${riskColor}; box-shadow:0 0 12px ${riskColor};"></div>
      <div class="tip">#${anomaly.id} (${anomaly.confidence}%)</div>
    `;
    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      soundFx.playSonarPing();
      document.querySelectorAll('.qorvia-marker.active').forEach(m => m.classList.remove('active'));
      marker.classList.add('active');
      selectTarget(anomaly);
      fetchLiveMarineData(anomaly.lat, anomaly.lng);
    });
    mapWorldEl.appendChild(marker);
    appState.markerEls.push(marker);
  });

  refreshRiskRings();
}

function selectTarget(target) {
  appState.activeTarget = target;

  const targetTitle = document.getElementById('target-title');
  const targetBadge = document.getElementById('target-risk-badge');
  const targetCoords = document.getElementById('target-coords');
  const targetDepth = document.getElementById('target-depth');
  const targetRegion = document.getElementById('target-region');

  if (targetTitle) targetTitle.textContent = `${target.name}`;
  if (targetCoords) targetCoords.textContent = `${target.lat.toFixed(4)}°, ${target.lng.toFixed(4)}°`;
  if (targetDepth) targetDepth.textContent = target.depth;
  if (targetRegion) targetRegion.textContent = target.regionName;

  if (targetBadge) {
    targetBadge.textContent = `RISK: ${target.risk.toUpperCase()} (${target.confidence}%)`;
    if (target.risk === 'high') targetBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/40';
    else if (target.risk === 'med') targetBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40';
    else targetBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
  }

  drawAnalysisCanvas(target.sampleImage);
}

/* ==========================================================================
   3. LIVE OPEN-METEO MARINE TELEMETRY API
   ========================================================================== */
async function fetchLiveMarineData(lat, lng) {
  const waveElem    = document.getElementById('live-wave');
  const currentElem = document.getElementById('live-current');
  const dirElem     = document.getElementById('live-dir');
  const statusDot   = document.getElementById('marine-api-status-dot');
  const statusText  = document.getElementById('marine-api-status-text');

  if (!waveElem) return;

  if (waveElem)    waveElem.textContent    = '···';
  if (currentElem) currentElem.textContent = '···';
  if (dirElem)     dirElem.textContent     = '···';
  if (statusDot)  { statusDot.classList.remove('bg-emerald-400'); statusDot.classList.add('bg-amber-400'); }
  if (statusText) statusText.textContent = 'Fetching · Open-Meteo Marine API…';

  try {
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&current=wave_height,wave_direction,wave_period,ocean_current_velocity`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const c = data.current || {};

    const waveH  = c.wave_height != null ? `${Number(c.wave_height).toFixed(1)}m` : `${(1.1 + Math.sin(lat * 0.1) * 0.5).toFixed(1)}m`;
    const curVel = c.ocean_current_velocity != null ? `${(c.ocean_current_velocity * 1.944).toFixed(1)} kt` : `${(1.2 + Math.cos(lng * 0.1) * 0.4).toFixed(1)} kt`;
    const waveDir = c.wave_direction != null ? `${Math.round(c.wave_direction)}°` : `${Math.round(180 + lat * 2)}°`;

    if (waveElem)    waveElem.textContent    = waveH;
    if (currentElem) currentElem.textContent = curVel;
    if (dirElem)     dirElem.textContent     = waveDir;

    if (statusDot)  { statusDot.classList.remove('bg-amber-400'); statusDot.classList.add('bg-emerald-400'); }
    if (statusText) statusText.textContent = 'Live · Open-Meteo Marine API';
  } catch (err) {
    const estWave = (1.1 + Math.sin(lat * 0.1) * 0.5).toFixed(1);
    const estCur  = (1.2 + Math.cos(lng * 0.1) * 0.4).toFixed(1);
    const estDir  = Math.round(180 + lat * 2);

    if (waveElem)    waveElem.textContent    = `${estWave}m`;
    if (currentElem) currentElem.textContent = `${estCur} kt`;
    if (dirElem)     dirElem.textContent     = `${estDir}°`;

    if (statusDot)  { statusDot.classList.remove('bg-amber-400'); statusDot.classList.add('bg-slate-400'); }
    if (statusText) statusText.textContent = 'Estimated · Location may be on land';
  }

  updateZoomDependentTemp();
}

/* ==========================================================================
   4. LIVE GOOGLE GEMINI VISION AI API & TESTER
   ========================================================================== */
function initApiManager() {
  const btnTest = document.getElementById('btn-test-api-key');
  const inputKey = document.getElementById('input-api-key');
  const testResult = document.getElementById('api-test-result');
  const statusBadge = document.getElementById('api-status-badge');

  if (!btnTest || !inputKey) return;

  btnTest.addEventListener('click', async () => {
    const key = inputKey.value.trim();
    if (!key) {
      testResult.textContent = '⚠️ Please enter an API key to test';
      testResult.className = 'text-[11px] font-mono text-amber-400';
      return;
    }

    testResult.textContent = 'Testing connection...';
    testResult.className = 'text-[11px] font-mono text-cyan-400 animate-pulse';

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      if (res.ok) {
        testResult.textContent = '✓ Connected to Gemini Vision API';
        testResult.className = 'text-[11px] font-mono text-emerald-400 font-bold';
        statusBadge.textContent = '● Gemini Vision API Active';
        statusBadge.className = 'text-[10px] font-mono text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/40';
        soundFx.playSuccess();
      } else {
        const errData = await res.json();
        testResult.textContent = `✕ Error: ${errData.error?.message || 'Invalid Key'}`;
        testResult.className = 'text-[11px] font-mono text-red-400';
      }
    } catch (e) {
      testResult.textContent = '✕ Network error connecting to Gemini API';
      testResult.className = 'text-[11px] font-mono text-red-400';
    }
  });
}

async function callGeminiVisionAPI(base64Data, apiKey) {
  try {
    const cleanBase64 = base64Data.split(',')[1] || base64Data;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const body = {
      contents: [{
        parts: [
          {
            text: `You are an expert marine debris and ghost fishing net detection AI system.
Analyze this satellite or aerial marine image carefully.

Detect any:
- Marine debris (plastics, foam, containers)
- Ghost fishing nets or longlines
- Oil spills or contamination slicks
- Any other maritime hazards

Respond ONLY in this exact JSON format (no markdown, no code blocks):
{
  "detections": [
    {"label": "Debris", "confidence": 94, "risk": "HIGH", "description": "Dense polyethylene macro-debris aggregation"},
    {"label": "Ghost Net", "confidence": 72, "risk": "MED", "description": "Submerged nylon monofilament netting"}
  ],
  "overall_risk": "HIGH",
  "summary": "Brief 1-sentence summary of the marine scene"
}`
          },
          { inline_data: { mime_type: 'image/jpeg', data: cleanBase64 } }
        ]
      }]
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    try {
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return { detections: [], summary: rawText, overall_risk: 'MED' };
    }
  } catch (e) {
    console.warn('Gemini Vision API call error:', e.message);
    return null;
  }
}

function applyGeminiResults(geminiResult, target) {
  if (!geminiResult) return;

  const banner = document.getElementById('gemini-live-banner');
  if (banner) banner.classList.replace('hidden', 'flex');

  const bboxContainer = document.getElementById('bbox-container');
  const summaryElem = document.getElementById('target-summary-text');

  if (summaryElem && geminiResult.summary) summaryElem.textContent = geminiResult.summary;

  if (bboxContainer && geminiResult.detections && geminiResult.detections.length > 0) {
    bboxContainer.innerHTML = '';
    const positions = [
      { top: '22%', left: '35%', width: '28%', height: '32%' },
      { top: '55%', left: '62%', width: '25%', height: '26%' },
      { top: '15%', left: '10%', width: '20%', height: '22%' },
      { top: '40%', left: '5%',  width: '22%', height: '20%' }
    ];

    geminiResult.detections.slice(0, 4).forEach((det, i) => {
      const pos = positions[i] || positions[0];
      const riskClass = det.risk === 'HIGH' ? 'ai-bbox-high' : det.risk === 'MED' ? 'ai-bbox-med' : 'ai-bbox-low';
      const badgeColor = det.risk === 'HIGH' ? 'bg-red-600' : det.risk === 'MED' ? 'bg-amber-600' : 'bg-emerald-600';
      const box = document.createElement('div');
      box.className = `ai-bbox ${riskClass}`;
      box.style.cssText = `top:${pos.top};left:${pos.left};width:${pos.width};height:${pos.height}`;
      box.innerHTML = `<span class="absolute -top-5 left-0 ${badgeColor} text-[9px] font-mono font-bold text-white px-1.5 py-0.2 rounded shadow">${det.label} ${det.confidence}%</span>`;
      box.addEventListener('click', () => {
        soundFx.playSonarPing();
        alert(`Qorvia AI Detection Inspector\n\n${det.label}\nConfidence: ${det.confidence}%\nRisk: ${det.risk}\n\n${det.description || ''}`);
      });
      bboxContainer.appendChild(box);
    });
  }

  const detCountElem = document.querySelector('#card-results-stage .text-emerald-300');
  if (detCountElem && geminiResult.detections) {
    detCountElem.closest('.text-sm')?.querySelector('span:last-child')?.textContent
      && (detCountElem.closest('.text-sm').querySelector('span:last-child').textContent = `${geminiResult.detections.length} Objects Detected`);
  }
}

window.viewSensorById = function(id) {
  const target = oceanAnomalies.find(a => a.id === id) || oceanAnomalies[0];
  selectTarget(target);
  openSensorModal(target);
};

window.downloadTargetData = function(id, format) {
  const target = oceanAnomalies.find(a => a.id === id) || oceanAnomalies[0];
  downloadAnomalyFile(target, format);
};

/* ==========================================================================
   5. FILTERS LOGIC (positioned beside the compass, top-left of the map)
   ========================================================================== */
function initFilters() {
  const filterPanel = document.getElementById('filter-box-panel');
  const btnToggle = document.getElementById('btn-toggle-filter-pop');
  const btnReset = document.getElementById('btn-reset-filters');

  if (btnToggle && filterPanel) {
    btnToggle.addEventListener('click', () => {
      soundFx.playSonarPing();
      filterPanel.classList.toggle('hidden');
      btnToggle.classList.toggle('bg-cyan-900/60');
    });
  }

  document.querySelectorAll('.filter-region').forEach(cb => {
    cb.addEventListener('change', () => {
      appState.filters.regions = Array.from(document.querySelectorAll('.filter-region:checked')).map(el => el.value);
      renderMapAnomalies();
    });
  });
  document.querySelectorAll('.filter-object').forEach(cb => {
    cb.addEventListener('change', () => {
      appState.filters.objects = Array.from(document.querySelectorAll('.filter-object:checked')).map(el => el.value);
      renderMapAnomalies();
    });
  });
  document.querySelectorAll('.filter-risk').forEach(cb => {
    cb.addEventListener('change', () => {
      appState.filters.risks = Array.from(document.querySelectorAll('.filter-risk:checked')).map(el => el.value);
      renderMapAnomalies();
    });
  });

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      document.querySelectorAll('.filter-region, .filter-object, .filter-risk').forEach(cb => cb.checked = true);
      appState.filters.regions = ['PAC', 'ATL', 'IND', 'ARC', 'SOU', 'MED'];
      appState.filters.objects = ['debris', 'ghostnet', 'misc'];
      appState.filters.risks = ['high', 'med', 'low'];
      renderMapAnomalies();
    });
  }
}

/* ==========================================================================
   6. MAGNIFYING GLASS TOOL
   ========================================================================== */
function initMagnifier() {
  const btnMagnifier = document.getElementById('btn-toggle-magnifier');
  const btnText = document.getElementById('magnifier-btn-text');
  const lens = document.getElementById('magnifier-lens');
  const mapElem = document.getElementById('ocean-map');

  if (!btnMagnifier || !lens || !mapElem) return;

  btnMagnifier.addEventListener('click', () => {
    soundFx.playSonarPing();
    appState.magnifierActive = !appState.magnifierActive;
    if (appState.magnifierActive) {
      lens.style.display = 'block';
      btnMagnifier.classList.add('bg-cyan-600', 'text-white', 'border-cyan-400');
      btnText.textContent = 'Magnifier Loupe: ON';
      mapElem.style.cursor = 'crosshair';
    } else {
      lens.style.display = 'none';
      btnMagnifier.classList.remove('bg-cyan-600', 'text-white', 'border-cyan-400');
      btnText.textContent = 'Magnifier Loupe: OFF';
      mapElem.style.cursor = '';
    }
  });

  mapElem.addEventListener('mousemove', (e) => {
    if (!appState.magnifierActive) return;
    const rect = mapElem.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    lens.style.left = `${x - 85}px`;
    lens.style.top = `${y - 85}px`;
  });

  mapElem.addEventListener('mouseleave', () => { if (appState.magnifierActive) lens.style.display = 'none'; });
  mapElem.addEventListener('mouseenter', () => { if (appState.magnifierActive) lens.style.display = 'block'; });
}

/* ==========================================================================
   7. FILE UPLOAD & AI PROCESSING PIPELINE
   ========================================================================== */
function initUploadPipeline() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const previewCard = document.getElementById('file-preview-card');
  const previewName = document.getElementById('preview-name');
  const previewFormat = document.getElementById('preview-format');
  const previewSize = document.getElementById('preview-size');
  const previewTag = document.getElementById('preview-format-tag');

  const btnCancel = document.getElementById('btn-cancel-upload');
  const btnConfirm = document.getElementById('btn-confirm-upload');

  const cardUpload = document.getElementById('card-upload-stage');
  const cardProcessing = document.getElementById('card-processing-stage');
  const cardResults = document.getElementById('card-results-stage');
  const btnReanalyze = document.getElementById('btn-reanalyze');

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('border-cyan-400', 'bg-cyan-950/40'); });
  dropzone.addEventListener('dragleave', () => { dropzone.classList.remove('border-cyan-400', 'bg-cyan-950/40'); });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('border-cyan-400', 'bg-cyan-950/40');
    if (e.dataTransfer.files.length > 0) handleFileSelected(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', (e) => { if (e.target.files.length > 0) handleFileSelected(e.target.files[0]); });

  document.querySelectorAll('.btn-sample-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      soundFx.playSonarPing();
      const fileData = {
        name: btn.dataset.filename,
        format: btn.dataset.format,
        size: btn.dataset.size,
        sensor: btn.dataset.sensor,
        imagePath: btn.dataset.filename.includes('Sentinel') || btn.dataset.filename.includes('BOB') ? 'assets/satellite_bob_0241.jpg' : 'assets/sonar_arabian_scan.jpg'
      };
      displayFilePreview(fileData);
    });
  });

  function handleFileSelected(file) {
    const ext = file.name.split('.').pop().toUpperCase();
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    const fileData = { name: file.name, format: ext || 'GEOTIFF', size: sizeMb, sensor: 'Uploaded Planetary Dataset', rawFile: file };

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => { appState.uploadedImageDataUrl = e.target.result; };
      reader.readAsDataURL(file);
    }
    displayFilePreview(fileData);
  }

  function displayFilePreview(fileData) {
    appState.uploadedFile = fileData;
    previewName.textContent = fileData.name;
    previewFormat.textContent = fileData.format;
    previewSize.textContent = fileData.size;
    previewTag.textContent = fileData.format;
    previewCard.classList.remove('hidden');
  }

  btnCancel.addEventListener('click', () => {
    previewCard.classList.add('hidden');
    appState.uploadedFile = null;
    appState.uploadedImageDataUrl = null;
    fileInput.value = '';
  });

  btnConfirm.addEventListener('click', () => { startAIProcessing(); });

  function startAIProcessing() {
    soundFx.playSonarPing();
    cardUpload.classList.add('hidden');
    cardResults.classList.add('hidden');
    cardProcessing.classList.remove('hidden');
    cardProcessing.classList.add('flex');

    const progressBar = document.getElementById('processing-progress-bar');
    const progressLabel = document.getElementById('progress-pct-label');
    const statusText = document.getElementById('processing-status-text');
    const subText = document.getElementById('processing-subtext');
    const timerCounter = document.getElementById('timer-counter');

    const statusSteps = [
      { pct: 15, text: 'Connecting to Qorvia Satellite Node...', sub: 'Establishing 256-bit encrypted link to Sentinel-2 & NOAA buoys' },
      { pct: 35, text: 'Decompressing Multispectral Bands & GeoTIFF...', sub: 'Unpacking SWIR, NIR, and Coastal Red-Edge channels' },
      { pct: 58, text: 'Fetching Live Oceanographic Telemetry API...', sub: 'Querying Open-Meteo current vectors & wave heights' },
      { pct: 78, text: 'Detecting Synthetic Polyamide Signatures...', sub: 'Scanning spectral absorption peaks at 1200nm & 1730nm' },
      { pct: 92, text: 'Running YOLOv11-OceanNet Deep Classifier...', sub: 'Segmenting ghost nets, plastic debris, and hazards' },
      { pct: 100, text: 'Analysis Complete! Synthesizing Global Vectors...', sub: 'Generating geospatial bounds & confidence vectors' }
    ];

    let stepIndex = 0;
    let secondsLeft = 5;
    timerCounter.textContent = `00:0${secondsLeft}`;

    const countdown = setInterval(() => {
      secondsLeft--;
      if (secondsLeft >= 0) timerCounter.textContent = `00:0${secondsLeft}`;
    }, 1000);

    const stepInterval = setInterval(() => {
      if (stepIndex < statusSteps.length) {
        const step = statusSteps[stepIndex];
        progressBar.style.width = `${step.pct}%`;
        progressLabel.textContent = `${step.pct}%`;
        statusText.textContent = step.text;
        subText.textContent = step.sub;
        soundFx.playSonarPing();
        stepIndex++;
      } else {
        clearInterval(stepInterval);
        clearInterval(countdown);
        setTimeout(() => { soundFx.playSuccess(); showAnalysisResults(); }, 600);
      }
    }, 900);
  }

  async function showAnalysisResults() {
    cardProcessing.classList.add('hidden');
    cardProcessing.classList.remove('flex');
    cardResults.classList.remove('hidden');
    cardResults.classList.add('flex');

    drawAnalysisCanvas(appState.uploadedImageDataUrl || (appState.uploadedFile && appState.uploadedFile.imagePath));

    const newDetection = {
      id: 'G099',
      name: 'Target #G099 - AI Classified Marine Hazard',
      type: 'ghostnet',
      typeName: 'Synthetic Polyamide Ghost Netting',
      region: 'PAC',
      regionName: 'Pacific Ocean (GPGP Sector)',
      lat: 31.8500,
      lng: -144.6000,
      depth: '28m',
      risk: 'high',
      confidence: 96.2,
      sensor: appState.uploadedFile ? appState.uploadedFile.name : 'Sentinel-2 Global Tile',
      size: '340m²',
      mass: '~410 kg',
      desc: 'Qorvia Multimodal Vision detected 7 debris anomalies with 2 high-priority retrieval targets.'
    };

    oceanAnomalies.unshift(newDetection);
    renderMapAnomalies();
    selectTarget(newDetection);
    fetchLiveMarineData(newDetection.lat, newDetection.lng);

    if (appState.mapReady) flyTo(newDetection.lat, newDetection.lng, 8);

    const apiKey = localStorage.getItem('qorvia_api_key');
    if (apiKey && apiKey.length > 10 && appState.uploadedImageDataUrl) {
      const banner = document.getElementById('gemini-live-banner');
      if (banner) banner.classList.replace('hidden', 'flex');
      try {
        const geminiResult = await callGeminiVisionAPI(appState.uploadedImageDataUrl, apiKey);
        if (geminiResult) { applyGeminiResults(geminiResult, newDetection); soundFx.playSuccess(); }
      } catch (e) { console.warn('Gemini post-result call failed:', e); }
    }
  }

  btnReanalyze.addEventListener('click', () => {
    cardResults.classList.add('hidden');
    cardProcessing.classList.add('hidden');
    cardUpload.classList.remove('hidden');
    previewCard.classList.add('hidden');
    appState.uploadedFile = null;
    appState.uploadedImageDataUrl = null;
    fileInput.value = '';
  });

  const btnToggleBbox = document.getElementById('btn-toggle-bbox');
  const bboxContainer = document.getElementById('bbox-container');
  if (btnToggleBbox && bboxContainer) {
    btnToggleBbox.addEventListener('click', () => { bboxContainer.classList.toggle('hidden'); });
  }

  document.querySelectorAll('.btn-download-format').forEach(btn => {
    btn.addEventListener('click', () => { downloadAnomalyFile(appState.activeTarget || oceanAnomalies[0], btn.dataset.type); });
  });

  const btnDlCsv = document.getElementById('btn-download-csv');
  const btnDlJson = document.getElementById('btn-download-json');
  if (btnDlCsv) btnDlCsv.addEventListener('click', () => downloadAnomalyFile(appState.activeTarget || oceanAnomalies[0], 'CSV'));
  if (btnDlJson) btnDlJson.addEventListener('click', () => downloadAnomalyFile(appState.activeTarget || oceanAnomalies[0], 'JSON'));
}

/* ==========================================================================
   8. HAMBURGER MENU (now floats on the LEFT edge of the map) & SETTINGS
   ========================================================================== */
function initHamburgerMenu() {
  const btnHamburger = document.getElementById('btn-hamburger');
  const btnClose = document.getElementById('btn-close-hamburger');
  const backdrop = document.getElementById('hamburger-backdrop');
  const drawer = document.getElementById('hamburger-drawer');
  const menu = document.getElementById('hamburger-menu');

  function openHamburger() {
    soundFx.playSonarPing();
    menu.classList.remove('pointer-events-none');
    backdrop.classList.remove('opacity-0');
    backdrop.classList.add('opacity-100');
    drawer.classList.remove('-translate-x-full');
    drawer.classList.add('translate-x-0');
  }
  function closeHamburger() {
    backdrop.classList.remove('opacity-100');
    backdrop.classList.add('opacity-0');
    drawer.classList.remove('translate-x-0');
    drawer.classList.add('-translate-x-full');
    setTimeout(() => { menu.classList.add('pointer-events-none'); }, 300);
  }

  btnHamburger.addEventListener('click', openHamburger);
  btnClose.addEventListener('click', closeHamburger);
  backdrop.addEventListener('click', closeHamburger);

  const menuSettings = document.getElementById('menu-item-settings');
  const modalSettings = document.getElementById('settings-modal');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  const inputApiKey = document.getElementById('input-api-key');
  const btnToggleApiKey = document.getElementById('btn-toggle-api-key');
  if (inputApiKey) {
    inputApiKey.value = localStorage.getItem('qorvia_api_key') || '';
    if (btnToggleApiKey) {
      btnToggleApiKey.addEventListener('click', () => {
        if (inputApiKey.type === 'password') { inputApiKey.type = 'text'; btnToggleApiKey.textContent = 'HIDE'; }
        else { inputApiKey.type = 'password'; btnToggleApiKey.textContent = 'SHOW'; }
      });
    }
  }

  menuSettings.addEventListener('click', () => { closeHamburger(); modalSettings.classList.remove('hidden'); });
  btnCloseSettings.addEventListener('click', () => modalSettings.classList.add('hidden'));
  btnSaveSettings.addEventListener('click', () => {
    const thresh = document.getElementById('setting-threshold').value;
    appState.settings.threshold = parseInt(thresh);
    if (inputApiKey) {
      localStorage.setItem('qorvia_api_key', inputApiKey.value.trim());
      appState.settings.geminiApiKey = inputApiKey.value.trim();
    }
    modalSettings.classList.add('hidden');
    renderMapAnomalies();
    soundFx.playSuccess();
    alert('Global settings & Gemini API configuration saved successfully.');
  });

  const rangeThreshold = document.getElementById('setting-threshold');
  const labelThreshold = document.getElementById('threshold-val');
  if (rangeThreshold && labelThreshold) {
    rangeThreshold.addEventListener('input', (e) => {
      labelThreshold.textContent = `${e.target.value}%`;
      appState.settings.threshold = parseInt(e.target.value);
      renderMapAnomalies();
    });
  }

  const menuDownloads = document.getElementById('menu-item-downloads');
  const modalDownloads = document.getElementById('downloads-modal');
  const btnCloseDl = document.getElementById('btn-close-downloads');
  const btnCloseDlBtn = document.getElementById('btn-close-downloads-btn');
  if (menuDownloads && modalDownloads) {
    menuDownloads.addEventListener('click', () => { closeHamburger(); modalDownloads.classList.remove('hidden'); soundFx.playSonarPing(); });
    if (btnCloseDl) btnCloseDl.addEventListener('click', () => modalDownloads.classList.add('hidden'));
    if (btnCloseDlBtn) btnCloseDlBtn.addEventListener('click', () => modalDownloads.classList.add('hidden'));
  }

  const menuTheme = document.getElementById('menu-item-theme');
  const themeStatusText = document.getElementById('theme-status-text');
  const themeKnob = document.getElementById('theme-switch-knob');
  const iconSun = document.getElementById('theme-icon-sun');
  const iconMoon = document.getElementById('theme-icon-moon');

  menuTheme.addEventListener('click', () => {
    soundFx.playSonarPing();
    if (appState.theme === 'dark') {
      appState.theme = 'light';
      document.body.classList.add('light-theme');
      themeStatusText.textContent = 'Current: Maritime Light';
      themeKnob.classList.remove('translate-x-5'); themeKnob.classList.add('translate-x-0');
      iconMoon.classList.add('hidden'); iconSun.classList.remove('hidden');
    } else {
      appState.theme = 'dark';
      document.body.classList.remove('light-theme');
      themeStatusText.textContent = 'Current: Deep Ocean Dark';
      themeKnob.classList.remove('translate-x-0'); themeKnob.classList.add('translate-x-5');
      iconSun.classList.add('hidden'); iconMoon.classList.remove('hidden');
    }
  });

  const menuAbout = document.getElementById('menu-item-about');
  const footerAbout = document.getElementById('footer-link-about');
  const modalAbout = document.getElementById('about-modal');
  const btnCloseAbout = document.getElementById('btn-close-about');
  const btnAckAbout = document.getElementById('btn-ack-about');

  const openAbout = () => { soundFx.playSonarPing(); closeHamburger(); modalAbout.classList.remove('hidden'); };
  menuAbout.addEventListener('click', openAbout);
  if (footerAbout) footerAbout.addEventListener('click', openAbout);
  btnCloseAbout.addEventListener('click', () => modalAbout.classList.add('hidden'));
  btnAckAbout.addEventListener('click', () => modalAbout.classList.add('hidden'));

  window.closeHamburger = closeHamburger;
}

/* ==========================================================================
   9. SENSOR TELEMETRY MODAL ("View Sensor")
   ========================================================================== */
function initTelemetryModal() {
  const btnViewSensor = document.getElementById('btn-view-sensor');
  const modal = document.getElementById('sensor-modal');
  const btnClose = document.getElementById('btn-close-sensor-modal');
  const btnModalClose = document.getElementById('btn-modal-close');

  if (btnViewSensor) {
    btnViewSensor.addEventListener('click', () => { soundFx.playSonarPing(); openSensorModal(appState.activeTarget || oceanAnomalies[0]); });
  }
  btnClose.addEventListener('click', () => modal.classList.add('hidden'));
  btnModalClose.addEventListener('click', () => modal.classList.add('hidden'));
}

function openSensorModal(target) {
  const modal = document.getElementById('sensor-modal');
  modal.classList.remove('hidden');
  setTimeout(() => { drawSpectralChart(); drawSonarChart(); }, 100);
}

/* ==========================================================================
   10. CANVAS DRAWINGS (Spectral Curves, Sonar Profile)
   ========================================================================== */
function initDrawings() {
  window.addEventListener('resize', () => { drawSpectralChart(); drawSonarChart(); drawAnalysisCanvas(); });
}

function drawAnalysisCanvas(customImageSrc) {
  const canvas = document.getElementById('analysis-image-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.parentElement.clientWidth || 380;
  const h = canvas.parentElement.clientHeight || 176;
  canvas.width = w; canvas.height = h;

  if (customImageSrc) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { ctx.drawImage(img, 0, 0, w, h); };
    img.src = customImageSrc;
    return;
  }

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#041830'); grad.addColorStop(0.5, '#082848'); grad.addColorStop(1, '#020e1c');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)'; ctx.lineWidth = 1;
  for (let y = 10; y < h; y += 18) {
    ctx.beginPath(); ctx.moveTo(0, y);
    for (let x = 0; x < w; x += 20) { const dy = Math.sin(x * 0.05 + y * 0.1) * 6; ctx.lineTo(x, y + dy); }
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255, 80, 80, 0.5)'; ctx.lineWidth = 1.5;
  const cx = w * 0.48, cy = h * 0.45;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath(); ctx.arc(cx + (i % 3) * 12, cy + Math.floor(i / 3) * 10, 18, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawSpectralChart() {
  const canvas = document.getElementById('spectral-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.parentElement.clientWidth - 32, h = 140;
  canvas.width = w; canvas.height = h;
  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'; ctx.lineWidth = 1;
  for (let y = 20; y < h; y += 30) { ctx.beginPath(); ctx.moveTo(35, y); ctx.lineTo(w - 10, y); ctx.stroke(); }

  ctx.fillStyle = '#64748b'; ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.fillText('400nm (Blue)', 35, h - 5);
  ctx.fillText('850nm (NIR)', w * 0.45, h - 5);
  ctx.fillText('2200nm (SWIR)', w - 80, h - 5);

  ctx.beginPath(); ctx.strokeStyle = '#0284c7'; ctx.lineWidth = 2;
  ctx.moveTo(40, 40); ctx.bezierCurveTo(w * 0.3, 70, w * 0.6, 110, w - 20, 115); ctx.stroke();

  ctx.beginPath(); ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 2.5;
  ctx.moveTo(40, 90);
  ctx.bezierCurveTo(w * 0.25, 45, w * 0.45, 30, w * 0.6, 75);
  ctx.bezierCurveTo(w * 0.75, 40, w * 0.85, 25, w - 20, 80);
  ctx.stroke();

  ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(w * 0.6, 75, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f87171'; ctx.fillText('Polyamide Absorption Peak (1215nm)', w * 0.52, 65);
}

function drawSonarChart() {
  const canvas = document.getElementById('sonar-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.parentElement.clientWidth - 32, h = 120;
  canvas.width = w; canvas.height = h;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = '#64748b'; ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.fillText('0m (Surface)', 10, 18);
  ctx.fillText('40m', 10, 55);
  ctx.fillText('80m (Target)', 10, 90);
  ctx.fillText('120m (Seabed)', 10, 115);

  ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.moveTo(90, 110);
  for (let x = 90; x < w; x += 15) ctx.lineTo(x, 105 + Math.sin(x * 0.1) * 5);
  ctx.lineTo(w, h); ctx.lineTo(90, h); ctx.closePath(); ctx.fill();

  ctx.strokeStyle = '#ef4444'; ctx.fillStyle = 'rgba(239, 68, 68, 0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(w * 0.55, 82, 35, 12, 0, 0, Math.PI * 2); ctx.stroke(); ctx.fill();

  ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)'; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(w * 0.55, 10); ctx.lineTo(w * 0.55, 70); ctx.stroke(); ctx.setLineDash([]);
}

/* ==========================================================================
   11. REPORT DOWNLOAD GENERATORS
   ========================================================================== */
function downloadAnomalyFile(target, format) {
  soundFx.playSuccess();
  let content = '', mimeType = 'text/plain', filename = `Qorvia_Global_${target.id}_${Date.now()}`;

  if (format === 'CSV') {
    mimeType = 'text/csv;charset=utf-8;'; filename += '.csv';
    content = `TARGET_ID,NAME,TYPE,RISK,CONFIDENCE,LATITUDE,LONGITUDE,DEPTH,OCEAN_SECTOR,ESTIMATED_MASS,SENSOR\n` +
      `"${target.id}","${target.name}","${target.type}","${target.risk}","${target.confidence}%",${target.lat},${target.lng},"${target.depth}","${target.regionName}","${target.mass}","${target.sensor}"\n`;
  } else if (format === 'JSON') {
    mimeType = 'application/json;charset=utf-8;'; filename += '.json';
    const geoJson = {
      type: "FeatureCollection",
      timestamp: new Date().toISOString(),
      platform: "Qorvia Planetary Network v1.0",
      features: [{
        type: "Feature",
        geometry: { type: "Point", coordinates: [target.lng, target.lat] },
        properties: {
          targetId: target.id, name: target.name, classification: target.typeName,
          risk: target.risk, confidence: target.confidence, depth: target.depth,
          region: target.regionName, sensor: target.sensor, massKg: target.mass, areaSqMeters: target.size
        }
      }]
    };
    content = JSON.stringify(geoJson, null, 2);
  } else if (format === 'PDF') {
    mimeType = 'text/plain;charset=utf-8;'; filename += '.txt';
    content = `===========================================================\n` +
      `           QORVIA PLANETARY NETWORK - GLOBAL INCIDENT REPORT \n` +
      `===========================================================\n` +
      `Target Identifier  : #${target.id}\n` +
      `Classification     : ${target.typeName}\n` +
      `Risk Assessment    : ${target.risk.toUpperCase()} (${target.confidence}% Confidence)\n` +
      `Global Coordinates : ${target.lat.toFixed(4)} Lat, ${target.lng.toFixed(4)} Lng\n` +
      `Oceanic Gyre       : ${target.regionName}\n` +
      `Depth Sounding     : ${target.depth}\n` +
      `Sensor Array       : ${target.sensor}\n` +
      `Estimated Mass     : ${target.mass}\n` +
      `Estimated Area     : ${target.size}\n` +
      `Observation Time   : ${new Date().toUTCString()}\n` +
      `Operational Action : Dispatched to Global Marine Debris Removal Fleet\n` +
      `===========================================================\n` +
      `Reserved @ 2026 - Qorvia AI Planetary Detection Network\n`;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* ==========================================================================
   12. BOUNDING BOX INSPECTOR & DEMO TOUR
   ========================================================================== */
function initBboxInteractions() {
  document.querySelectorAll('.ai-bbox').forEach(box => {
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      soundFx.playSonarPing();
      alert(`Qorvia AI Detection Inspector:\n\nHigh-Risk Synthetic Ghost Net Array\nConfidence: 96.8%\nPolymer Match: Polyamide-6 (Nylon)\nEntanglement Profile: Severe Cetacean Threat`);
    });
  });
}

function initDemoTour() {
  const btnTour = document.getElementById('btn-tour-mode');
  if (!btnTour) return;
  btnTour.addEventListener('click', () => { startDemoTour(); });
}

function startDemoTour() {
  soundFx.playSonarPing();
  if (appState.mapReady) flyTo(14.5, 78.0, 8);

  setTimeout(() => {
    selectTarget(oceanAnomalies.find(a => a.region === 'IND') || oceanAnomalies[0]);
    fetchLiveMarineData(oceanAnomalies[0].lat, oceanAnomalies[0].lng);
  }, 1800);

  setTimeout(() => { const samplePreset = document.querySelector('.btn-sample-preset'); if (samplePreset) samplePreset.click(); }, 3500);
  setTimeout(() => { const btnConfirm = document.getElementById('btn-confirm-upload'); if (btnConfirm) btnConfirm.click(); }, 5000);
  setTimeout(() => { openSensorModal(oceanAnomalies[0]); }, 11500);
}