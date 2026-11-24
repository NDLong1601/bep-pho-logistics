// =========================================================================
// 1. EXTENSIBLE GAME CONFIGURATION (GAME_CONFIG)
// =========================================================================
const GAME_CONFIG = {
  SAVE_KEY: 'bep_pho_logistics_v1',
  // Bump when the save format changes and add a step to SAVE_MIGRATIONS in state.js.
  SAVE_VERSION: 4,
  GRID_COLS: 4,
  GRID_ROWS: 4,
  TILE_SIZE: 4.4,
  TILE_GAP: 0.14,
  WALL_HEIGHT: 2.35,
  MAX_LEVEL: Infinity,
  MAX_STAFF_PER_ROOM: 6,

  rooms: {
    warehouse: {
      id: 'warehouse',
      name: 'Kho Nguyên Liệu',
      icon: '🥬',
      category: 'Logistics',
      unlockLevel: 1,
      expPerCycle: 7,
      cost: 180,
      upgradeBase: 140,
      staffCost: 110,
      cycleTime: 4.5,
      desc: 'Nhập và bảo quản thực phẩm tươi, gia vị và thùng hàng cho khu bếp.',
      effectText: '+3 Nguyên liệu / chu kỳ',
      floorStyle: 'concrete',
      floorTint: '#DFD9D0',
      wallColor: '#ECE5DC',
      trimColor: '#9E734E',
      staffColor: '#D68432',
      glassFront: true,
      starter: true,
      produce: (lv, staff, mult) => ({ ingredients: Math.round((2 + lv) * (1 + (staff - 1) * 0.45) * mult) })
    },
    kitchen: {
      id: 'kitchen',
      name: 'Bếp Nấu Trung Tâm',
      icon: '🍳',
      category: 'Nhà hàng',
      unlockLevel: 1,
      expPerCycle: 9,
      cost: 240,
      upgradeBase: 180,
      staffCost: 130,
      cycleTime: 4.2,
      desc: 'Chế biến Phở từ nguyên liệu kho. Mỗi bát cần nước dùng từ nồi ninh; bồn rửa đầy bát bẩn thì bếp phải dừng.',
      effectText: '2 Kho + nước dùng → Món nóng',
      floorStyle: 'tile',
      floorTint: '#EFEAE1',
      wallColor: '#F3EDE4',
      trimColor: '#A96F42',
      staffColor: '#F8F8F6',
      glassFront: true,
      starter: true,
      requires: { ingredients: 2 },
      produce: (lv, staff, mult) => ({ dishes: Math.round((1 + lv * 0.8) * (1 + (staff - 1) * 0.4) * mult) })
    },
    dining: {
      id: 'dining',
      name: 'Phòng Ăn Bistro',
      icon: '🍽️',
      category: 'Nhà hàng',
      unlockLevel: 1,
      expPerCycle: 10,
      cost: 280,
      upgradeBase: 200,
      staffCost: 140,
      cycleTime: 4.8,
      desc: 'Khách từ ngoài phố vào xếp hàng, ngồi bàn, ăn phở rồi trả tiền. Nâng cấp để có thêm bàn ghế.',
      effectText: 'Khách ngồi ăn: 1 Món → Xu & Uy tín',
      floorStyle: 'wood',
      floorTint: '#D3A676',
      wallColor: '#EFE6DA',
      trimColor: '#8E5B36',
      staffColor: '#4A6E8F',
      glassFront: true,
      starter: true,
      customerVenue: true,
      // Price of one bowl paid by a seated customer (not a timed cycle).
      produce: (lv, staff, mult, bonuses) => ({
        coins: Math.round((48 + lv * 18) * (1 + (staff - 1) * 0.35) * mult * bonuses.revenueMult),
        rep: 1,
        served: 1
      })
    },
    packing: {
      id: 'packing',
      name: 'Trạm Đóng Gói',
      icon: '📦',
      category: 'Logistics',
      unlockLevel: 2,
      expPerCycle: 11,
      cost: 320,
      upgradeBase: 220,
      staffCost: 150,
      cycleTime: 4.0,
      desc: 'Dây chuyền phân loại, đóng hộp giữ nhiệt và dán mã vận đơn giao hàng.',
      effectText: '2 Món → 2 Đơn sẵn sàng',
      floorStyle: 'slate',
      floorTint: '#AEBCCC',
      wallColor: '#EAECEE',
      trimColor: '#8C623E',
      staffColor: '#2B8080',
      glassFront: true,
      starter: false,
      requires: { dishes: 2 },
      produce: (lv, staff, mult) => ({ parcels: Math.round((1.5 + lv * 0.7) * (1 + (staff - 1) * 0.4) * mult) })
    },
    dispatch: {
      id: 'dispatch',
      name: 'Bãi Xe Giao Nhận',
      icon: '🛵',
      category: 'Logistics',
      unlockLevel: 3,
      expPerCycle: 14,
      cost: 420,
      upgradeBase: 280,
      staffCost: 180,
      cycleTime: 5.5,
      desc: 'Điều phối đội xe giao đơn đóng gói khắp thành phố với lợi nhuận cao.',
      effectText: '1 Đơn → +115 Xu & +2 Uy tín',
      floorStyle: 'asphalt',
      floorTint: '#C8C4BD',
      wallColor: '#E5DFD7',
      trimColor: '#7B604A',
      staffColor: '#D15540',
      glassFront: false,
      starter: false,
      requires: { parcels: 1 },
      produce: (lv, staff, mult, bonuses) => ({
        coins: Math.round((95 + lv * 35) * (1 + (staff - 1) * 0.4) * mult * bonuses.revenueMult),
        rep: 2,
        served: 1
      })
    },
    cafe: {
      id: 'cafe',
      name: 'Quầy Trà & Cà Phê',
      icon: '☕',
      category: 'Nhà hàng',
      unlockLevel: 4,
      expPerCycle: 13,
      cost: 380,
      upgradeBase: 250,
      staffCost: 160,
      cycleTime: 5.0,
      desc: 'Phục vụ đồ uống và bánh ngọt, đồng thời tăng +12% giá trị mọi đơn hàng.',
      effectText: '+40 Xu thụ động & +12% doanh thu',
      floorStyle: 'wood_light',
      floorTint: '#E5CBA5',
      wallColor: '#F5EDE1',
      trimColor: '#8A5A35',
      staffColor: '#7A4A38',
      glassFront: true,
      starter: false,
      passiveBonus: { revenuePct: 0.12 },
      produce: (lv, staff, mult, bonuses) => ({
        coins: Math.round((32 + lv * 14) * (1 + (staff - 1) * 0.35) * mult * bonuses.revenueMult),
        rep: 1
      })
    },
    office: {
      id: 'office',
      name: 'Văn Phòng Điều Hành',
      icon: '💼',
      category: 'Quản trị',
      unlockLevel: 5,
      expPerCycle: 16,
      cost: 520,
      upgradeBase: 340,
      staffCost: 220,
      cycleTime: 6.5,
      desc: 'Trung tâm điều phối tuyến đường logistics & quản trị bếp: +15% tốc độ toàn khu.',
      effectText: '+15% tốc độ vận hành & +1 Uy tín',
      floorStyle: 'wood_dark',
      floorTint: '#C6A37D',
      wallColor: '#EDE5D9',
      trimColor: '#764B2C',
      staffColor: '#33465C',
      glassFront: true,
      starter: false,
      passiveBonus: { speedPct: 0.15 },
      produce: (lv, staff, mult) => ({
        coins: Math.round((25 + lv * 12) * staff * mult),
        rep: 1
      })
    },
    cold_storage: {
      id: 'cold_storage',
      name: 'Kho Lạnh Bảo Quản',
      icon: '❄️',
      category: 'Logistics',
      unlockLevel: 6,
      expPerCycle: 16,
      cost: 460,
      upgradeBase: 300,
      staffCost: 190,
      cycleTime: 4.8,
      desc: 'Hệ thống cấp đông giữ tươi thực phẩm và sơ chế sẵn, đồng thời tăng +8% tốc độ & doanh thu.',
      effectText: '+2 Kho & +1 Món · +8% tốc độ & doanh thu',
      floorStyle: 'slate',
      floorTint: '#CFE0EA',
      wallColor: '#EDF4F7',
      trimColor: '#5B7C92',
      staffColor: '#3E84A8',
      glassFront: true,
      starter: false,
      passiveBonus: { speedPct: 0.08, revenuePct: 0.08 },
      produce: (lv, staff, mult) => ({
        ingredients: Math.round((1.5 + lv * 0.6) * (1 + (staff - 1) * 0.35) * mult),
        dishes: Math.round((1 + lv * 0.35) * (1 + (staff - 1) * 0.25) * mult)
      })
    },
    marketing: {
      id: 'marketing',
      name: 'Phòng Marketing & App',
      icon: '📱',
      category: 'Quản trị',
      unlockLevel: 7,
      expPerCycle: 19,
      cost: 580,
      upgradeBase: 380,
      staffCost: 230,
      cycleTime: 5.8,
      desc: 'Studio chụp món, livestream và chạy ưu đãi App: tăng +18% doanh thu toàn khu.',
      effectText: '+2 Uy tín & +18% doanh thu toàn chuỗi',
      floorStyle: 'wood_light',
      floorTint: '#E9D6C3',
      wallColor: '#F7EFE6',
      trimColor: '#8B5A3C',
      staffColor: '#B84B6E',
      glassFront: true,
      starter: false,
      passiveBonus: { revenuePct: 0.18 },
      produce: (lv, staff, mult, bonuses) => ({
        coins: Math.round((36 + lv * 16) * (1 + (staff - 1) * 0.35) * mult * bonuses.revenueMult),
        rep: 2
      })
    },
    drone_hub: {
      id: 'drone_hub',
      name: 'Trạm Drone Giao Nhanh',
      icon: '🚁',
      category: 'Logistics',
      unlockLevel: 8,
      expPerCycle: 25,
      cost: 780,
      upgradeBase: 480,
      staffCost: 280,
      cycleTime: 5.0,
      desc: 'Đội bay Drone tự động giao 2 đơn siêu tốc xuyên thành phố với lợi nhuận vượt trội.',
      effectText: '2 Đơn → +270 Xu & +3 Uy tín',
      floorStyle: 'asphalt',
      floorTint: '#B9C0C7',
      wallColor: '#E4E9EE',
      trimColor: '#465666',
      staffColor: '#2B6E8C',
      glassFront: false,
      starter: false,
      requires: { parcels: 2 },
      produce: (lv, staff, mult, bonuses) => ({
        coins: Math.round((230 + lv * 75) * (1 + (staff - 1) * 0.42) * mult * bonuses.revenueMult),
        rep: 3,
        served: 2
      })
    }
  },

  contracts: [
    { id: 'c1', title: 'Bữa trưa văn phòng phố cổ', desc: 'Tích lũy 6 món ăn nóng hổi', metric: 'dishes', target: 6, reward: 220, rep: 3 },
    { id: 'c2', title: 'Mở rộng khu đóng gói', desc: 'Xây dựng ít nhất 4 phân khu hoạt động', metric: 'roomCount', target: 4, reward: 320, rep: 5 },
    { id: 'c3', title: 'Chuyến giao hàng đầu tiên', desc: 'Đóng gói 4 đơn hàng sẵn sàng giao', metric: 'parcels', target: 4, reward: 380, rep: 6 },
    { id: 'c4', title: 'Khách quen ghé quán', desc: 'Phục vụ tổng cộng 12 lượt khách / đơn', metric: 'totalServed', target: 12, reward: 480, rep: 8 },
    { id: 'c5', title: 'Chuỗi nhà hàng - giao nhận', desc: 'Sở hữu ít nhất 6 phân khu trên bản đồ', metric: 'roomCount', target: 6, reward: 650, rep: 12 },
    { id: 'c6', title: 'Bếp phố nổi tiếng', desc: 'Đạt 60 điểm Uy tín thương hiệu', metric: 'rep', target: 60, reward: 950, rep: 15 },
    { id: 'c7', title: 'Trung tâm ẩm thực khu vực', desc: 'Phục vụ tổng cộng 45 lượt khách / đơn', metric: 'totalServed', target: 45, reward: 1400, rep: 20 }
  ],

  synergies: {
    warehouse: [
      { withType: 'cold_storage', speedPct: 0.20, revenuePct: 0, label: 'Sát Kho Lạnh (+20% tốc độ)' }
    ],
    kitchen: [
      { withType: 'warehouse', speedPct: 0.20, revenuePct: 0, label: 'Sát Kho Nguyên Liệu (+20% tốc độ)' },
      { withType: 'cold_storage', speedPct: 0.20, revenuePct: 0, label: 'Sát Kho Lạnh (+20% tốc độ)' }
    ],
    dining: [
      { withType: 'kitchen', speedPct: 0, revenuePct: 0.20, label: 'Sát Bếp Nấu (+20% doanh thu)' },
      { withType: 'cafe', speedPct: 0, revenuePct: 0.20, label: 'Cạnh Quầy Cà Phê (+20% doanh thu)' },
      { withType: 'marketing', speedPct: 0, revenuePct: 0.20, label: 'Cạnh Phòng Marketing (+20% doanh thu)' }
    ],
    packing: [
      { withType: 'kitchen', speedPct: 0.20, revenuePct: 0, label: 'Sát Bếp Nấu (+20% tốc độ)' }
    ],
    dispatch: [
      { withType: 'packing', speedPct: 0.25, revenuePct: 0, label: 'Sát Trạm Đóng Gói (+25% tốc độ)' },
      { withType: 'drone_hub', speedPct: 0.20, revenuePct: 0, label: 'Cạnh Trạm Drone (+20% tốc độ)' }
    ],
    cafe: [
      { withType: 'dining', speedPct: 0, revenuePct: 0.20, label: 'Cạnh Phòng Ăn Bistro (+20% doanh thu)' },
      { withType: 'marketing', speedPct: 0, revenuePct: 0.15, label: 'Cạnh Phòng Marketing (+15% doanh thu)' }
    ],
    office: [
      { withType: 'kitchen', speedPct: 0.15, revenuePct: 0.15, label: 'Sát Bếp Nấu (+15% hiệu suất)' },
      { withType: 'packing', speedPct: 0.15, revenuePct: 0.15, label: 'Sát Trạm Đóng Gói (+15% hiệu suất)' },
      { withType: 'dispatch', speedPct: 0.15, revenuePct: 0.15, label: 'Sát Bãi Xe Giao Nhận (+15% hiệu suất)' },
      { withType: 'marketing', speedPct: 0.15, revenuePct: 0.15, label: 'Sát Phòng Marketing (+15% hiệu suất)' },
      { withType: 'drone_hub', speedPct: 0.15, revenuePct: 0.15, label: 'Sát Trạm Drone (+15% hiệu suất)' }
    ],
    cold_storage: [
      { withType: 'warehouse', speedPct: 0.20, revenuePct: 0, label: 'Sát Kho Nguyên Liệu (+20% tốc độ)' },
      { withType: 'kitchen', speedPct: 0.15, revenuePct: 0, label: 'Sát Bếp Nấu (+15% tốc độ)' }
    ],
    marketing: [
      { withType: 'dining', speedPct: 0, revenuePct: 0.20, label: 'Cạnh Phòng Ăn Bistro (+20% doanh thu)' },
      { withType: 'office', speedPct: 0.15, revenuePct: 0.15, label: 'Sát Văn Phòng (+15% hiệu suất)' }
    ],
    drone_hub: [
      { withType: 'packing', speedPct: 0.25, revenuePct: 0, label: 'Sát Trạm Đóng Gói (+25% tốc độ)' },
      { withType: 'dispatch', speedPct: 0.15, revenuePct: 0.15, label: 'Sát Bãi Xe (+15% hiệu suất)' }
    ]
  },

  menus: {
    pho_bo: {
      id: 'pho_bo',
      name: 'Phở Bò Gia Truyền',
      icon: '🍜',
      unlockLevel: 1,
      unlockRep: 0,
      desc: 'Nước dùng ninh xương đậm đà, tăng +15% doanh thu ăn tại chỗ.',
      kitchenSpeed: 1.0,
      packingSpeed: 1.0,
      diningRev: 1.15,
      dispatchRev: 1.0
    },
    banh_mi: {
      id: 'banh_mi',
      name: 'Bánh Mì & Cà Phê Phố',
      icon: '🥖',
      unlockLevel: 3,
      unlockRep: 15,
      desc: 'Phục vụ siêu tốc cho dân văn phòng: +25% tốc độ Bếp & Đóng gói, +15% doanh thu giao hàng.',
      kitchenSpeed: 1.25,
      packingSpeed: 1.25,
      diningRev: 1.05,
      dispatchRev: 1.15
    },
    com_tam: {
      id: 'com_tam',
      name: 'Cơm Tấm Sườn Nướng',
      icon: '🍛',
      unlockLevel: 5,
      unlockRep: 35,
      desc: 'Suất ăn đầy đặn giá trị cao: +20% doanh thu Bistro, +30% doanh thu Giao nhận.',
      kitchenSpeed: 1.0,
      packingSpeed: 1.10,
      diningRev: 1.20,
      dispatchRev: 1.30
    },
    lau_pho: {
      id: 'lau_pho',
      name: 'Đại Tiệc Lẩu Phố Cổ',
      icon: '🍲',
      unlockLevel: 8,
      unlockRep: 65,
      desc: 'Thực đơn thượng hạng: +20% tốc độ chế biến & đóng gói, +35% doanh thu toàn kênh.',
      kitchenSpeed: 1.20,
      packingSpeed: 1.20,
      diningRev: 1.35,
      dispatchRev: 1.35
    }
  },

  gridTiers: [
    { size: 4, label: '4×4 (16 ô)', cost: 0, minRep: 0, unlockLevel: 1 },
    { size: 5, label: '5×5 (25 ô)', cost: 1200, minRep: 15, unlockLevel: 4 },
    { size: 6, label: '6×6 (36 ô)', cost: 2600, minRep: 40, unlockLevel: 7 }
  ],

  levelMilestones: [
    { level: 1, title: 'Khởi Nghiệp Bếp Phố', unlocks: 'Kho Nguyên Liệu, Bếp Nấu, Phòng Ăn Bistro, Gộp ô không gian & Cửa nhân viên' },
    { level: 2, title: 'Đóng Gói Chuyên Nghiệp', unlocks: '📦 Trạm Đóng Gói & ⚡ Đơn hàng Khẩn cấp' },
    { level: 3, title: 'Đội Shipper Phố Cổ', unlocks: '🛵 Bãi Xe Giao Nhận & 🥖 Thực đơn Bánh Mì Phố' },
    { level: 4, title: 'Mở Rộng Không Gian', unlocks: '☕ Quầy Trà & Cà Phê & 🗺️ Khu đất 5×5 (25 ô)' },
    { level: 5, title: 'Quản Trị Chuỗi Cung Ứng', unlocks: '💼 Văn Phòng Điều Hành & 🍛 Thực đơn Cơm Tấm' },
    { level: 6, title: 'Chuỗi Cung Ứng Lạnh', unlocks: '❄️ Kho Lạnh Bảo Quản' },
    { level: 7, title: 'Bùng Nổ Thương Hiệu Số', unlocks: '📱 Phòng Marketing & App & 🗺️ Khu đất 6×6 (36 ô)' },
    { level: 8, title: 'Giao Vận Tương Lai', unlocks: '🚁 Trạm Drone Giao Nhanh & 🍲 Đại Tiệc Lẩu Phố Cổ' },
    { level: 9, title: 'Đại Sư Ẩm Thực (Vô Hạn)', unlocks: 'Nâng cấp công trình cấp độ vô hạn & Hào quang Kiến trúc Tinh Anh' }
  ],

  dayPhases: [
    { id: 'morning', start: 0, end: 18, label: '☀️ Buổi sáng', speedPct: 0, revenuePct: 0, isNight: false, isRush: false },
    { id: 'lunch_rush', start: 18, end: 30, label: '🔥 Cao điểm Trưa', speedPct: 0.30, revenuePct: 0.20, isNight: false, isRush: true },
    { id: 'sunset', start: 30, end: 37, label: '🌅 Hoàng hôn', speedPct: 0, revenuePct: 0, isNight: false, isRush: false },
    { id: 'night_rush', start: 37, end: 45, label: '🌙 Đêm Phố Cổ', speedPct: 0, revenuePct: 0.25, isNight: true, isRush: true }
  ],

  expressTemplates: [
    { title: 'Giao gấp cơm trưa văn phòng', resource: 'dishes', baseAmount: 4, baseReward: 170, rep: 3, timeLimit: 40 },
    { title: 'Đơn tiệc trà chiều công ty', resource: 'dishes', baseAmount: 6, baseReward: 250, rep: 4, timeLimit: 42 },
    { title: 'Chuyến giao nhanh giờ cao điểm', resource: 'parcels', baseAmount: 3, baseReward: 290, rep: 5, timeLimit: 38 },
    { title: 'Cung ứng nhanh nguyên liệu sạch', resource: 'ingredients', baseAmount: 6, baseReward: 150, rep: 3, timeLimit: 36 },
    { title: 'Đơn VIP khách sạn phố cổ', resource: 'parcels', baseAmount: 5, baseReward: 430, rep: 7, timeLimit: 45 }
  ],

  // Dining room guests are real customers now (see restaurant below), so the
  // order rail only carries café and delivery orders.
  ticketTemplates: [
    { id: 'tea_party', title: 'Khách Trà Chiều', icon: '☕', requiresType: 'cafe', resource: 'dishes', amount: 1, patience: 22, reward: 75, tip: 25, rep: 1, vip: false },
    { id: 'office_delivery', title: 'Shipper Giao Phố', icon: '🛵', requiresType: 'dispatch', resource: 'parcels', amount: 1, patience: 26, reward: 125, tip: 35, rep: 2, vip: false },
    { id: 'drone_express', title: 'Đơn Drone Cao Tốc', icon: '🚁', requiresType: 'drone_hub', resource: 'parcels', amount: 2, patience: 22, reward: 240, tip: 70, rep: 3, vip: false }
  ],

  restaurant: {
    customers: {
      baseIntervalSec: 7,      // time between arrivals at 0 reputation
      repPerBoost: 120,        // every 120 rep = +100% arrival rate
      maxRepBoost: 1.5,
      rushIntervalMult: 0.6,   // lunch / night rush
      minIntervalSec: 2.2,
      maxQueue: 4,             // per dining room
      queuePatienceSec: 22,
      foodPatienceSec: 26,
      serveDelaySec: 1.6,      // waiter brings the bowl
      eatSec: 8,
      vipChance: 0.08,
      vipMinRep: 12,
      vipPayMult: 2.2,
      vipBonusRep: 2
    },
    broth: { baseCap: 24, capPerLevel: 8, ingredientCost: 6, simmerSec: 18 },
    sink: { baseCap: 10, capPerLevel: 4, autoWashPerStaffSec: 0.06, washPerTap: 5 },
    counter: { baseCap: 10, capPerLevel: 4 },  // bowls ready at the pass
    // Ingredient storage: warehouses idle when full. cap = base + perStorageLevel × (sum of warehouse & cold storage levels)
    storage: { baseCap: 25, perStorageLevel: 15 }
  },

  staff: {
    traits: [
      { id: 'cham_chi', name: 'Chăm chỉ', icon: '💪', desc: 'làm đều tay, không bao giờ lơ là', staffBonus: 0.2, weight: 3 },
      { id: 'nhanh', name: 'Nhanh nhẹn', icon: '⚡', desc: 'đi lại và làm việc nhanh hơn', staffBonus: 0.3, speedMult: 1.35, weight: 3 },
      { id: 'chu_dao', name: 'Chu đáo', icon: '🤝', desc: 'khách trong phòng kiên nhẫn hơn 15%', staffBonus: 0.15, patienceBonus: 0.15, weight: 2 },
      { id: 'ngu_gat', name: 'Hay ngủ gật', icon: '💤', desc: 'tỉnh thì làm rất giỏi, nhưng thỉnh thoảng ngủ gật', staffBonus: 0.45, dozes: true, weight: 2 }
    ],
    dozeEverySec: [35, 75],   // time awake between naps
    dozeMaxSec: 30,           // wakes up alone after this if nobody taps
    wakeExp: 5,
    waiterSpeed: 1.6,
    washerCost: 160,
    maxWashersPerKitchen: 2,
    washerBowlsPerSec: 0.25,
    upkeepPerStaff: 10
  },

  perkCards: [
    { id: 'sharp_knives', name: 'Dao Bếp Sắc Bén', icon: '🔪', desc: '+18% tốc độ chế biến & nhập kho cho Bếp Nấu, Kho.', effect: 'kitchenSpeed' },
    { id: 'warm_hospitality', name: 'Trà Đá Miễn Phí', icon: '🫖', desc: '+25% thời gian kiên nhẫn của mọi Phiếu Order.', effect: 'patience' },
    { id: 'tip_jar', name: 'Hộp Tip Phố Cổ', icon: '💰', desc: '+35% Tiền Tip từ khách hàng & chuỗi Combo.', effect: 'tip' },
    { id: 'lean_operation', name: 'Tối Ưu Vận Hành', icon: '📋', desc: 'Giảm 25% chi phí lương & bảo trì cuối ngày.', effect: 'upkeep' },
    { id: 'safe_kitchen', name: 'Bếp Chuẩn 5 Sao', icon: '🛡️', desc: 'Giảm 45% nguy cơ sự cố quá nhiệt & bàn bẩn.', effect: 'hazard' },
    { id: 'fast_packaging', name: 'Băng Chuyền Siêu Tốc', icon: '📦', desc: '+22% tốc độ Trạm Đóng Gói, Bãi Xe & Trạm Drone.', effect: 'logisticsSpeed' },
    { id: 'viral_brand', name: 'Tiếng Lành Đồn Xa', icon: '🌟', desc: '+15% doanh thu gốc mọi đơn & nhận ngay +5 Uy tín.', effect: 'revenue', instantRep: 5 }
  ]
};
