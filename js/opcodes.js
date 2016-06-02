

var OpCodes = function(cpu) {
	this.cpu = cpu;
	this.cbOpCodes = [];
	this.installCbOpCodes();
};

OpCodes.inc = function(cpu, r) {
	var tmp = r();
	var half = tmp & 0xF ? 1 : 0;
	cpu.flags(tmp + 1, 'Z0' + half + '-');
	r(tmp + 1);
};

OpCodes.dec = function(cpu, r) { var tmp = r() - 1; cpu.flags(tmp, 'Z1H-'); r(tmp); };

OpCodes.rlc = function(cpu, r) { throw 'RLC not implemented yet'; };
OpCodes.rrc = function(cpu, r) {
	var tmp = r();
	var b0 = tmp & 0x1;
	tmp = tmp >>> 1 | (b0 ? 0x80 : 0);
	cpu.flags(tmp, 'Z00' + b0);
	r(tmp);
};

OpCodes.rl = function(cpu, r) { throw 'RL not implemented yet'; };
OpCodes.rr = function(cpu, r) {
	var tmp = r();
	var c = tmp & 0x1;
	tmp = tmp >>> 1 | (cpu.f.c() ? 0x80 : 0);
	cpu.flags(tmp, 'Z00' + c);
	r(tmp);
};

OpCodes.sla = function(cpu, r) { throw 'SLA not implemented yet'; };
OpCodes.sra = function(cpu, r) { throw 'SRA not implemented yet'; };
OpCodes.swap = function(cpu, r) { throw 'SWAP not implemented yet'; };
OpCodes.srl = function(cpu, r) { throw 'SRL not implemented yet'; };
OpCodes.bit = function(cpu, r, bit) { throw 'BIT not implemented yet'; };
OpCodes.res = function(cpu, r, bit) { throw 'RES not implemented yet'; };
OpCodes.set = function(cpu, r, bit) { throw 'SET not implemented yet'; };

OpCodes.prototype.installCbOpCodes = function() {
	var cpu = this.cpu;
	var ops1 = [OpCodes.rlc, OpCodes.rrc, OpCodes.rl, OpCodes.rr,
		OpCodes.sla, OpCodes.sra, OpCodes.swap, OpCodes.srl];
	var ops2 = [OpCodes.bit, OpCodes.res, OpCodes.set];
	var regs = [cpu.b, cpu.c, cpu.d, cpu.e, cpu.h, cpu.l, cpu.hla, cpu.a];
	for (var opCode = 0x0; opCode < 0xFF; opCode++) {
		var row = opCode >>> 4;
		var column = opCode & 0x8 ? 1 : 0;
		var bit = ((row - 4 & 0x3) << 1) + column;
		var operator = row < 4 ? ops1[row] : ops2[row - 4 >>> 2];
		var operand = regs[opCode & 0x7];
		this.cbOpCodes[opCode] = { operator: operator, operand: operand, bit: bit };
	}
};

