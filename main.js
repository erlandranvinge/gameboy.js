var gpu = new GPU();
var spu = new SPU();
var mmu = new MMU(gpu, spu);
var cpu = new CPU(mmu);
var dbg = new Debugger(cpu, mmu);
mmu.setCartridge('/TETRIS.GB');

dbg.restart();
cpu.startRom();

var totalTicks = 0;
function tick(count, log) {
    for (var c = 0; c < count; c++) {
        var dt = 0.00001;
        if (log) dbg.regs();
        if (log) dbg.deasm();
        cpu.step(dt);
        gpu.tick(dt);
        spu.tick(dt);
        totalTicks++;
        //dbg.record();
        if (cpu.pc === 0x00FE)
            throw 'BOOT COMPLETED.';

    }
    gpu.display.blit();
    setTimeout(function() { tick(60000); }, 1);
}

tick(60000, 0);









