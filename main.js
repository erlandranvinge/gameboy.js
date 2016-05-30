var gpu = new GPU('canvas');
var spu = new SPU();
var mmu = new MMU(gpu, spu);
var cpu = new CPU(mmu);
var dbg = new Debugger(cpu, mmu, gpu);
gpu.cpu = cpu; // for now.

mmu.setCartridge('roms/tetris.gb');
cpu.startRom();

function tick() {
	var dt = 0.000001;
	var cycles = cpu.step(dt);
	gpu.step(cycles);
	dbg.step();
}

console.log(dbg.deasm());

var exit = false;
function runTo(address) {
	for (var i = 0; i < 100; i++) {
		if (cpu.pc === address)
			return;
		tick();
	}
	if (exit) {
		console.log('Bailed out!');
		return;
	}
	setTimeout(runTo, 2, address);
}

document.addEventListener('keydown', function(e) {
	switch(e.keyCode) {
		case 27: exit = true; break;
		case 32:
			exit = false;
			tick(1);
			console.log(dbg.deasm());
			break;
		case 65:
			dbg.drawTiles('vram');
			console.log('Tiles drawn');
			break;
		default:
	}
});
