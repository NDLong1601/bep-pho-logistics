// =========================================================================
// 1. EXTENSIBLE GAME CONFIGURATION (GAME_CONFIG)
// =========================================================================
const GAME_CONFIG = {
  SAVE_KEY: 'bep_pho_logistics_v1',
  GRID_COLS: 4,
  GRID_ROWS: 4,
  TILE_SIZE: 4.4,
  TILE_GAP: 0.14,
  WALL_HEIGHT: 2.35,
  MAX_LEVEL: 5,
  MAX_STAFF_PER_ROOM: 4,

  rooms: {
    warehouse: {
      id: 'warehouse',
      name: 'Kho Nguyên Liệu',
      icon: '🥬',
      category: 'Logistics',
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
      cost: 240,
      upgradeBase: 180,
      staffCost: 130,
      cycleTime: 4.2,
      desc: 'Chế biến Phở, Cơm tấm, Bánh mì từ nguyên liệu kho thành món nóng.',
      effectText: '2 Kho → 2 Món nóng',
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
      cost: 280,
      upgradeBase: 200,
      staffCost: 140,
      cycleTime: 4.8,
      desc: 'Không gian gỗ ấm áp đón thực khách dùng bữa tại chỗ và tạo dòng tiền đều.',
      effectText: '1 Món → +55 Xu & +1 Uy tín',
      floorStyle: 'wood',
      floorTint: '#D3A676',
      wallColor: '#EFE6DA',
      trimColor: '#8E5B36',
      staffColor: '#4A6E8F',
      glassFront: true,
      starter: true,
      requires: { dishes: 1 },
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
    kitchen: [
      { withType: 'warehouse', speedPct: 0.20, revenuePct: 0, label: 'Sát Kho Nguyên Liệu (+20% tốc độ)' }
    ],
    dining: [
      { withType: 'kitchen', speedPct: 0, revenuePct: 0.20, label: 'Sát Bếp Nấu (+20% doanh thu)' },
      { withType: 'cafe', speedPct: 0, revenuePct: 0.20, label: 'Cạnh Quầy Cà Phê (+20% doanh thu)' }
    ],
    packing: [
      { withType: 'kitchen', speedPct: 0.20, revenuePct: 0, label: 'Sát Bếp Nấu (+20% tốc độ)' }
    ],
    dispatch: [
      { withType: 'packing', speedPct: 0.25, revenuePct: 0, label: 'Sát Trạm Đóng Gói (+25% tốc độ)' }
    ],
    cafe: [
      { withType: 'dining', speedPct: 0, revenuePct: 0.20, label: 'Cạnh Phòng Ăn Bistro (+20% doanh thu)' }
    ],
    office: [
      { withType: 'kitchen', speedPct: 0.15, revenuePct: 0.15, label: 'Sát Bếp Nấu (+15% hiệu suất)' },
      { withType: 'packing', speedPct: 0.15, revenuePct: 0.15, label: 'Sát Trạm Đóng Gói (+15% hiệu suất)' },
      { withType: 'dispatch', speedPct: 0.15, revenuePct: 0.15, label: 'Sát Bãi Xe Giao Nhận (+15% hiệu suất)' }
    ]
  },

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
  ]
};
