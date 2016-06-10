
// Testroms: https://github.com/retrio/gb-test-roms


var gpu = new GPU('canvas');
var io = new Io();
var spu = new SPU();
var mmu = new MMU(gpu, spu, io);
var cpu = new CPU(mmu);
var dbg = new Debugger(cpu, mmu, gpu);
gpu.cpu = cpu; // for now.
io.bind();

mmu.setCartridge('roms/oprr.gb');
cpu.startRom();

totalCycles = 0;
trace = false;
function tick() {
	var dt = 0.000001;
	var cycles = cpu.step(dt);
	totalCycles += cycles;
	gpu.step(cycles);

	if (trace) {
		//dbg.step();
		dbg.trace();
	}
}

dbg.step();
console.log(dbg.deasm());

var exit = false;
function runTo(address) {
	tick();

	for (var i = 0; i < 10000; i++) {
		if (cpu.pc === address) {
			dbg.step();
			return;
		}
		tick();
		if (exit) break;

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
