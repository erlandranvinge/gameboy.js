var gpu = new GPU();
var spu = new SPU();
var mmu = new MMU(gpu, spu);
var cpu = new CPU(mmu);
var dbg = new Debugger(cpu, mmu);
mmu.setCartridge('roms/tetris.gb');

cpu.startRom();
var ticks = 0;
function tick(count) {
	for (var c = 0; c < count; c++) {
		var dt = 0.0001;
		cpu.step(dt);
		gpu.tick(dt);
		spu.tick(dt);
		dbg.tick();
		ticks++;
		if (cpu.pc === 0x00FE)
			throw 'BOOT COMPLETED.';
	}
	gpu.display.blit();
	setTimeout(tick, 5, 1000);
}
tick(1000);

document.addEventListener('keydown', function(e) {
	switch(e.keyCode) {
		case 32:
			if (dbg.attached) {
				dbg.detach();
			} else {
				dbg.attach();
			}
			break;
		default:
	}
});

