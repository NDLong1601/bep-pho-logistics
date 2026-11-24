import { CREW, DISHES } from './game.js';

const tables = [
  { x: 250, y: 373 }, { x: 710, y: 373 },
  { x: 250, y: 550 }, { x: 710, y: 550 }
];
const homes = {
  cook: { x: 302, y: 307 },
  waiter: { x: 472, y: 472 },
  cashier: { x: 695, y: 306 }
};
const coats = ['#8b523b', '#527354', '#586f88', '#ad653b', '#855a7c', '#53696a'];
const ink = '#624237';

export function createScene(canvas) {
  const context = canvas.getContext('2d');
  const figures = new Map();
  let artTime = 0;

  function oval(x, y, rx, ry, color, stroke = null, width = 2) {
    context.beginPath();
    context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = width;
      context.stroke();
    }
  }

  function box(x, y, width, height, radius, color, stroke = null) {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fillStyle = color;
    context.fill();
    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = 2;
      context.stroke();
    }
  }

  function line(points, color, width) {
    context.beginPath();
    context.moveTo(...points[0]);
    for (const point of points.slice(1)) context.lineTo(...point);
    context.strokeStyle = color;
    context.lineWidth = width;
    context.lineCap = 'round';
    context.stroke();
  }

  function chair(x, y, side) {
    oval(x, y + 11, 28, 9, '#5030224d');
    box(x - 20, y - 3, 5, 21, 2, '#7c402f', ink);
    box(x + 15, y - 3, 5, 21, 2, '#7c402f', ink);
    oval(x, y - 3, 24, 13, '#ac613c', ink);
    oval(x, y - 7, 21, 10, '#c3824e', '#955939');
    box(x + side * 17 - 4, y - 25, 8, 24, 4, '#a55c39', ink);
  }

  function furniture({ x, y }, table) {
    oval(x + 2, y + 25, 87, 22, '#59351f67');
    for (const offset of [-53, 53]) {
      box(x + offset - 5, y, 10, 32, 3, '#874a31', ink);
    }
    oval(x, y + 5, 77, 32, '#8c412b', ink, 2.6);
    oval(x, y, 76, 29, '#c57a48', ink, 2.5);
    oval(x, y - 1, 68, 25, '#cd8c55', '#e2aa70');
    line([[x - 54, y - 10], [x - 25, y - 15], [x + 15, y - 15]], '#eab57c', 1.3);
    line([[x - 48, y + 12], [x + 4, y + 17], [x + 30, y + 14]], '#a86139', 1.6);
    oval(x + 39, y - 7, 10, 4, '#a96137');
    box(x + 32, y - 17, 13, 10, 3, '#f8e8ba', '#936649');
    line([[x + 37, y - 16], [x + 37, y - 9]], '#bd713a', 1.5);
    if (table.stage === 'eating' || table.stage === 'check' || table.stage === 'dirty') {
      plate(x - 2, y + 4, table.guest ? DISHES[table.guest.dish].color : '#dcbf9b', table.stage === 'dirty');
    }
    if (table.stage === 'choosing' || table.stage === 'order') {
      box(x - 16, y - 6, 30, 16, 2, '#fbdf9e', '#a4613c');
      line([[x - 10, y - 1], [x + 8, y - 1]], '#ad6439', 1);
      line([[x - 10, y + 4], [x + 3, y + 4]], '#ad6439', 1);
    }
  }

  function plate(x, y, topping, empty = false) {
    oval(x, y + 3, 20, 8, '#f7e9d0', '#854d38');
    oval(x, y, 18, 8, '#fff6df', '#9b6a4c');
    oval(x, y, 13, 5, topping);
    if (!empty) {
      oval(x - 4, y, 4, 2, '#f1cd7e');
      oval(x + 4, y - 1, 4, 2, '#62804e');
      oval(x + 1, y + 2, 4, 1.7, '#f5dab1');
    }
  }

  function person(actor) {
    const { x, y, color, role, facing, moving, style, carries } = actor;
    const pace = moving ? Math.sin(artTime * 15 + style) : 0;
    context.save();
    context.translate(x, y);
    if (facing < 0) context.scale(-1, 1);
    oval(0, 1, 19, 6, '#432b2576');
    box(-10, -11 + pace * 2, 7, 12, 3, '#694139', ink);
    box(3, -11 - pace * 2, 7, 12, 3, '#694139', ink);
    box(-15, -36, 30, 26, 9, color, ink);
    if (role) {
      box(-8, -29, 17, 16, 4, '#f5dbac', '#82543c');
      line([[-6, -31], [-3, -24], [3, -24], [7, -31]], '#f4d7aa', 2.5);
    }
    oval(-14, -19 + pace * 3, 4, 6, '#e7af7f', ink);
    oval(14, -19 - pace * 3, 4, 6, '#e7af7f', ink);
    oval(-1, -47, 17, 18, style % 3 === 0 ? '#573c32' : '#684035', ink, 2);
    oval(4, -45, 13, 15, style % 3 === 2 ? '#d9996d' : '#efb98b', ink);
    oval(7, -46, 1.5, 2.2, '#52342a');
    oval(13, -46, 1.5, 2.2, '#52342a');
    oval(12, -41, 3, 1.7, '#d58770');
    if (role === 'cook') {
      box(-16, -64, 34, 10, 4, '#f6e5c7', '#82543c');
      oval(0, -65, 19, 10, '#fff1d6', '#82543c');
      box(-13, -62, 28, 8, 3, '#fbebcd');
    } else {
      line([[-10, -55], [-6, -59], [2, -60], [13, -55]], '#664336', 4);
    }
    if (carries) plate(20, -21, carries);
    context.restore();
  }

  function stand(id, target, properties, dt, reduced) {
    let figure = figures.get(id);
    if (!figure) {
      const spawn = properties.role ? homes[properties.role] : { x: 476, y: 699 };
      figure = { ...spawn, facing: 1 };
      figures.set(id, figure);
    }
    const distanceX = target.x - figure.x;
    const distanceY = target.y - figure.y;
    const weight = reduced ? 1 : 1 - Math.exp(-dt * 5.8);
    if (Math.abs(distanceX) > 4) figure.facing = distanceX < 0 ? -1 : 1;
    figure.x += distanceX * weight;
    figure.y += distanceY * weight;
    return { ...figure, ...properties, moving: !reduced && Math.hypot(distanceX, distanceY) > 4 };
  }

  function steam(x, y, reduced) {
    for (let i = 0; i < 3; i += 1) {
      const phase = reduced ? .3 : (artTime * .7 + i / 3) % 1;
      oval(x + i * 20 + Math.sin(phase * Math.PI) * 9, y - phase * 43, 4 + phase * 8, 7 + phase * 6, `rgba(255,242,209,${.45 * (1 - phase)})`);
    }
  }

  return function draw(game, delta, reduced) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    artTime += delta;
    const residents = [];
    const ids = new Set();
    function actor(id, target, properties) {
      ids.add(id);
      residents.push(stand(id, target, properties, delta, reduced));
    }
    for (const [i, guest] of game.queue.entries()) {
      actor(guest.id, { x: 458 + (i % 2) * 43, y: 671 - Math.floor(i / 2) * 40 }, {
        color: coats[guest.coat], style: guest.coat
      });
    }
    for (const table of game.tables) {
      const place = tables[table.id - 1];
      const seated = table.guest;
      if (seated) {
        const age = game.time - seated.seatedAt;
        actor(seated.id, age < .75 ? { x: 478, y: place.y - 4 } : { x: place.x - 86, y: place.y + 7 }, {
          color: coats[seated.coat], style: seated.coat
        });
      }
    }
    for (const [i, [role, worker]] of Object.entries(game.workers).entries()) {
      const job = worker.job;
      const place = job ? tables[job.tableId - 1] : null;
      let point = homes[role];
      if (job && role !== 'cook') {
        point = { x: place.x + 89, y: place.y + 16 };
        if (job.kind === 'serve' && job.remaining > job.duration * .7) point = homes.cashier;
      }
      const dish = job ? game.tables[job.tableId - 1].guest?.dish : null;
      actor(role, point, { role, color: CREW[role].color, style: i, carries: job?.kind === 'serve' && dish ? DISHES[dish].color : null });
    }
    for (const id of figures.keys()) if (!ids.has(id)) figures.delete(id);

    const objects = [];
    for (const table of game.tables) {
      const p = tables[table.id - 1];
      objects.push({ y: p.y - 8, paint: () => {
        chair(p.x - 83, p.y + 4, -1);
        chair(p.x + 83, p.y + 4, 1);
      } });
      objects.push({ y: p.y + 13, paint: () => furniture(p, table) });
    }
    for (const figure of residents) objects.push({ y: figure.y, paint: () => person(figure) });
    objects.sort((a, b) => a.y - b.y).forEach(item => item.paint());
    if (game.workers.cook.job) steam(154, 145, reduced);
    for (let i = 0; i < game.tables.length; i += 1) {
      const table = game.tables[i];
      if (table.stage === 'eating') steam(tables[i].x - 18, tables[i].y - 3, reduced);
    }
  };
}
