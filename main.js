var gpu = new GPU();
var spu = new SPU();
var mmu = new MMU(gpu, spu);
var cpu = new CPU(mmu);
var dbg = new Debugger(cpu, mmu);
mmu.setCartridge('roms/tetris.gb');

dbg.restart();
cpu.startRom();

var ticks = 0;
function tick(count) {
	for (var c = 0; c < count; c++) {
		var dt = 0.00001;
		cpu.step(dt);
		gpu.tick(dt);
		spu.tick(dt);
		ticks++;
		if (cpu.pc === 0x00FE)
			throw 'BOOT COMPLETED.';

	}
	gpu.display.blit();
}
tick(3000);

document.addEventListener('keydown', function(e) {
	switch(e.keyCode) {
		case 68: // d
			dbg.deasm();
			break;
		case 83: // s
			console.log(dbg.deasm());
			tick(1);
			console.log(dbg.deasm());
			break;
		case 82: // r
			console.log(dbg.regs(true));
			break;
		default:
			//console.log('Unknown key ' + e.keyCode + '.');
	}
});