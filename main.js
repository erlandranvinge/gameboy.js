var gpu = new GPU();
var spu = new SPU();
var mmu = new MMU(gpu, spu);
var cpu = new CPU(mmu);
var dbg = new Debugger(cpu, mmu);
gpu.cpu = cpu; // for now.

mmu.setCartridge('roms/tetris.gb');
cpu.startRom();
dbg.attach();

var ticks = 0;
var kill = false;
function tick(count) {
	if (kill) {
		console.info('Terminated!');
		return;
	}

	for (var c = 0; c < count; c++) {
		var dt = 0.000001;
		try {
			cpu.step(dt);
			gpu.tick(dt);
			spu.tick(dt);
			dbg.tick();
		} catch (e) {
			console.log(e);
			console.log('HALT! ' + dbg.regs());
			dbg.detach();
			return;
		}

		ticks++;
		if (cpu.pc === 0x00FE) {
			console.log(mmu.booting);
			throw 'BOOT COMPLETED.';
		}
	}
	//gpu.display.blit();
	gpu.display.drawTiles();
	setTimeout(tick, 5, 1000);
}
tick(1000);

document.addEventListener('keydown', function(e) {
	switch(e.keyCode) {
		case 27: kill = true; break;
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

