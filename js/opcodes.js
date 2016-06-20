

var OpCodes = {};

OpCodes.inc = function(cpu, r) {
	var tmp = r() + 1;
	var h = !(tmp & 0xF);
	cpu.flags(tmp, 'Z0' + h + '-');
	r(tmp);
};

OpCodes.dec = function(cpu, r) {
	var tmp = r();
	var h = tmp & 0xF < 1;
	tmp -= 1;
	cpu.flags(tmp, 'Z1' + h +'-');
	r(tmp);
};

OpCodes.add = function(cpu, value) {
	var a = cpu.a();
	a += value;
	var c = cpu.f.c();
	var h = cpu.f.h();

	if (a & 0x100) {
		c = c ? 0 : 1;
	}
	if (a & 0x10) {
		h = h ? 0 : 1;
	}
	cpu.flags(a, 'Z0' + h + c);
	cpu.a(a);
};

OpCodes.cp = function(cpu, d) {
	var a = cpu.a();
	var h = (a & 0xF) < (d & 0xF) ? 1 : 0;
	var c = a < d ? 1 : 0;
	cpu.flags(a - d, 'Z1' + h + c);
};

OpCodes.rlc = function(cpu, r) {
	throw 'RLC not implemented yet';
};

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
	var b0 = tmp & 0x1;
	tmp = tmp >>> 1 | (cpu.f.c() ? 0x80 : 0);
	cpu.flags(tmp, 'Z00' + b0);
	r(tmp);
};

OpCodes.sla = function(cpu, r) { throw 'SLA not implemented yet'; };
OpCodes.sra = function(cpu, r) { throw 'SRA not implemented yet'; };
OpCodes.swap = function(cpu, r) {
	var tmp = r();
	var swap = (tmp & 0xF << 4) | (tmp & 0xF0 >>> 4);
	cpu.flags(swap, 'Z000');
	r(swap);
};
OpCodes.srl = function(cpu, r) {
	var tmp = r();
	var c = tmp & 0x1;
	tmp >>>= 1;
	cpu.flags(tmp, 'Z00' + c);
	r(tmp);
};

OpCodes.bit = function(cpu, r, bit) { throw 'BIT not implemented yet'; };
OpCodes.res = function(cpu, r, bit) { throw 'RES not implemented yet'; };
OpCodes.set = function(cpu, r, bit) { throw 'SET not implemented yet'; };

OpCodes.cb = function(cpu, opCode) {
	var regs = [cpu.b, cpu.c, cpu.d, cpu.e, cpu.h, cpu.h, cpu.hla, cpu.a];

	/*
	var row = opCode >>> 4;
	var column = opCode & 0x8 ? 1 : 0;
	var bit = ((row - 4 & 0x3) << 1) + column;
	*/

	var name = 'UNKNOWN';
	var operand = regs[opCode & 0x7];

	if (opCode >= 0x40 && opCode <= 0x7F) { /* BIT */ }
	if (opCode >= 0x80 && opCode <= 0xB9) { /* RES */ }
	if (opCode >= 0xC0 && opCode <= 0xFF) { /* SET */ }

	switch(opCode & 0xF8) {
		case 0x00: OpCodes.rlc(cpu, operand); break;
		case 0x08: OpCodes.rrc(cpu, operand); break;
		case 0x10: OpCodes.rl(cpu, operand); break;
		case 0x18: OpCodes.rr(cpu, operand); break;
		case 0x20: OpCodes.sla(cpu, operand); break;
		case 0x28: OpCodes.sra(cpu, operand); break;
		case 0x30: OpCodes.swap(cpu, operand); break;
		case 0x38: OpCodes.srl(cpu, operand); break;
		default:
			throw 'Unknown cb op found: ' + opCode.toString(16);
	}

	/*
	var row = opCode >>> 4;
	var column = opCode & 0x8 ? 1 : 0;
	var bit = ((row - 4 & 0x3) << 1) + column;
	var operator = row < 4 ? this.cbOps1[row] : this.cbOps2[row - 4 >>> 2];
	var operand = this.cbRegs[opCode & 0x7];
	console.log(Debugger.cbOpCodeNames[opCode], row, column, row < 4);
	operator.call(this, operand, bit);*/
};

