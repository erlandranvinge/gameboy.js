var gpu = new GPU();
var spu = new SPU();
var mmu = new MMU(gpu, spu);
var cpu = new CPU(mmu);
var dbg = new Debugger(cpu, mmu, gpu);
gpu.cpu = cpu; // for now.

mmu.setCartridge('roms/tetris.gb');
cpu.startRom();

function tick() {

	var cycles = cpu.cycles;
	while (cycles == cpu.cycles) {
		var dt = 0.000001;
		cpu.step(dt);
		gpu.tick(dt);
		spu.tick(dt);
		dbg.tick();
	}
}

tick();

function runTo(address) {
	console.log('Running...');
	while(cpu.pc != address) {
		tick();
	}
	console.log(dbg.deasm());
}

document.addEventListener('keydown', function(e) {
	switch(e.keyCode) {
		case 32:
			tick(1);
			console.log(dbg.deasm());
			break;
		default:
	}
});
