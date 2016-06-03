
var gpu = new GPU('canvas');
var io = new Io();
var spu = new SPU();
var mmu = new MMU(gpu, spu, io);
var cpu = new CPU(mmu);
var dbg = new Debugger(cpu, mmu, gpu);
gpu.cpu = cpu; // for now.
io.bind();

mmu.setCartridge('roms/flow.gb');
cpu.startRom();

function tick() {
	var dt = 0.000001;
	var cycles = cpu.step(dt);
	gpu.step(cycles);
	dbg.step();
}

dbg.step();
console.log(dbg.deasm());

var exit = false;
function runTo(address) {
	tick();
	dbg.trace();

	for (var i = 0; i < 10000; i++) {
		if (cpu.pc === address)
			return;
		tick();
		//dbg.trace();
	}
	if (exit) {
		console.log('Bailed out!');
		return;
	}
	setTimeout(runTo, 0, address);
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
			break;
		default:
	}
});
