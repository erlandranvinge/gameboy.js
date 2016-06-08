
var Interrupt = {
	vBlank: 0x40
};

var CPU = function(mmu) {
	this.mmu = mmu;
	var self = this;

	this.a = function() {}; this.f = function() {};
	this.b = function() {}; this.c = function() {};
	this.d = function() {}; this.e = function() {};
	this.h = function() {}; this.l = function() {};

	this.af = this.register('af', 0x01B0);
	this.bc = this.register('bc', 0x0013);
	this.de = this.register('de', 0x00D8);
	this.hl = this.register('hl', 0x014D);
	this.hla = function(value) {
		if (value === undefined) return mmu.read(self.hl);
		mmu.write(self.hl, value);
	};

	this.f = {};
	this.f.z = function() { return self.af & 0x80 ? 1 : 0; };
	this.f.n = function() { return self.af & 0x40 ? 1 : 0; };
	this.f.h = function() { return self.af & 0x20 ? 1 : 0; };
	this.f.c = function() { return self.af & 0x10 ? 1 : 0; };

	this.ime = false;
	this.ie = 0x0;
	this.if = 0x0;
	this.halt = false;
};

CPU.prototype.register = function(name, value) {
	var self = this;
	this[name[0]] = function(value) {
		if (value === undefined) return (self[name] >>> 8) & 0xFF;
		self[name] = ((value & 0xFF) << 8) | (self[name] & 0xFF);
	};
	this[name[1]] = function(value) {
		if (value === undefined) return self[name] & 0xFF;
		self[name] = (value & 0xFF) | (self[name] & 0xFF00);
	};
	return value;
};

CPU.prototype.flags = function(value, mask) {

	var af = this.af;

	switch(mask[0]) {
		case '0': af &= ~0x80; break;
		case '1': af |= 0x80; break;
		case 'Z': if (!(value & 0xFF)) af |= 0x80; else af &= ~0x80; break;
	}
	switch(mask[1]) {
		case '0': af &= ~0x40; break;
		case '1': af |= 0x40; break;
	}
	switch(mask[2]) {
		case '0': af &= ~0x20; break;
		case '1': af |= 0x20; break;
		case 'H': if (value & 0x10 || value & 0x100) af |= 0x20; else af &= ~0x20; break;
	}
	switch(mask[3]) {
		case '0': af &= ~0x10; break;
		case '1': af |= 0x10; break;
		case 'C': if (value & 0x100) af |= 0x10; else af &= ~0x10; break;
	}
	this.af = af;
};

CPU.prototype.jump = function(address) {
	if (address & 0x80) address -= 256;
	this.pc += address;
};

CPU.prototype.call = function(condition) {
	if (condition) {
		this.mmu.writeWord(this.sp -= 2, this.pc + 3);
		this.pc = this.mmu.readWord(this.pc + 1);
		return true;
	}
	return false;
};

CPU.prototype.interrupt = function(address) {
	this.ie |= 0x1;
	if (!this.ime) return;
	this.ime = false;
	
	var ie = this.mmu.read(0xFFFF);
	if (ie & 0x1) {
		console.log('VBLANK @ ', hex(this.pc));
		this.pc = address;
		this.halt = false;
	}
};

CPU.prototype.step = function(dt) {

	if (this.halt) return 4;

	if (this.pc >= 0x8000 && this.pc < 0xA000)
		throw 'Trying to execute from video RAM: ' + hex(this.pc);

	var op = this.mmu.read(this.pc);
	var ops = OpCodes;
	var cycles = op === 0xCB ? 8 : this.opCodeCycles[op];

	var mmu = this.mmu;
	var a = 0, b = 0, r = 0, d = 0, c = 0, h = 0, hl = 0, sp = 0, jmp = false;
	switch (op) {
		// 8-bit arithmetic.
		case 0x05: ops.dec(this, this.b); break; // DEC B
		case 0x0D: ops.dec(this, this.c); break; // DEC C
		case 0x15: ops.dec(this, this.d); break; // DEC D
		case 0x1D: ops.dec(this, this.e); break; // DEC E
		case 0x25: ops.dec(this, this.h); break; // DEC H
		case 0x2D: ops.dec(this, this.l); break; // DEC L
		case 0x35: ops.dec(this, this.hla); break; // DEC (HL)
		case 0x3D: ops.dec(this, this.a); break; // DEC A

		case 0x04: ops.inc(this, this.b); break; // INC B
		case 0x0C: ops.inc(this, this.c); break; // INC C
		case 0x14: ops.inc(this, this.d); break; // INC D
		case 0x1C: ops.inc(this, this.e); break; // INC E
		case 0x24: ops.inc(this, this.h); break; // INC H
		case 0x2C: ops.inc(this, this.l); break; // INC L
		case 0x34: ops.inc(this, this.hla); break; // INC (HL)
		case 0x3C: ops.inc(this, this.a); break; // INC A

		// Unordered 8-bit arithmetic, please fix.
		case 0xA9: a = this.a() ^ this.c(); this.a(a); this.flags(a, 'Z000'); break; // XOR C
		case 0xAD: a = this.a() ^ this.l(); this.a(a); this.flags(a, 'Z000'); break; // XOR L
		case 0xAE: a = this.a() ^ this.hla(); this.a(a); this.flags(a, 'Z000'); break; // XOR (HL)
		case 0xAF: this.af = 0x80; break; // XOR A, A ????

		case 0xA0: a = this.a() & this.b(); this.a(a); this.flags(a, 'Z010'); break; // AND B
		case 0xA1: a = this.a() & this.c(); this.a(a); this.flags(a, 'Z010'); break; // AND C
		case 0xA2: a = this.a() & this.d(); this.a(a); this.flags(a, 'Z010'); break; // AND D
		case 0xA3: a = this.a() & this.e(); this.a(a); this.flags(a, 'Z010'); break; // AND E
		case 0xA4: a = this.a() & this.h(); this.a(a); this.flags(a, 'Z010'); break; // AND H
		case 0xA5: a = this.a() & this.l(); this.a(a); this.flags(a, 'Z010'); break; // AND L
		case 0xA6: a = this.a() & this.hla(); this.a(a); this.flags(a, 'Z010'); break; // AND (HL)
		case 0xA7: a = this.a() & this.a(); this.a(a); this.flags(a, 'Z010'); break; // AND A
		case 0xE6: a = this.a() & mmu.read(this.pc + 1); this.a(a); this.flags(a, 'Z010'); break; // AND d8

		case 0xB0: a = this.a() | this.b(); this.a(a); this.flags(a, 'Z000'); break; // OR B
		case 0xB1: a = this.a() | this.c(); this.a(a); this.flags(a, 'Z000'); break; // OR C
		case 0xB6: a = this.a() | this.hla(); this.a(a); this.flags(a, 'Z000'); break; // OR (HL)
		case 0xB7: a = this.a() | this.a(); this.a(a); this.flags(a, 'Z000'); break; // OR A
		case 0xF6: a = this.a() | mmu.read(this.pc + 1); this.a(a); this.flags(a, 'Z000'); break; // OR d8

		case 0x90: a = this.a() - this.b(); this.flags(a, 'Z1HC'); this.a(a); break; // SUB B
		case 0x91: a = this.a() - this.c(); this.flags(a, 'Z1HC'); this.a(a); break; // SUB C
		case 0x95: a = this.a() - this.l(); this.flags(a, 'Z1HC'); this.a(a); break; // SUB L
		case 0xD6: a = this.a() - mmu.read(this.pc + 1); this.flags(a, 'Z1HC'); this.a(a); break; // SUB d8

		case 0x07:
			var a = this.a();
			var b7 = a & 0x80 ? 1 : 0;
			a = (a << 1) | b7;
			this.flags(a, '000' + b7);
			this.a(a);
			break; // RLCA

		case 0x0F:
			// WARNING: Faulty flags!! Custom-implement.
			ops.rrc(this, this.a);
			break; // RRCA
		case 0x1F:
			ops.rr(this, this.a);
			this.af &= 0xFF10;
			break; // RRA
		case 0x2F: a = ~this.a(); this.a(a); this.flags(a, '-NH-'); break; // CPL (complement A)
		case 0xFE:
			a = this.a();
			d = mmu.read(this.pc + 1);
			h = (a & 0xF) < (d & 0xF) ? 1 : 0;
			c = a < d ? 1 : 0;
			this.flags(a - d, 'Z1' + h + c);
			break; // CP d8
		case 0xB9: a = this.a() - this.c(); this.flags(a, 'Z1HC'); break; // CP C
		case 0xBB: a = this.a() - this.e(); this.flags(a, 'Z1HC'); break; // CP E
		case 0xBE: a = this.a() - this.hla(); this.flags(a, 'Z1HC'); break; // CP (HL)

		case 0x80: a = this.a() + this.b(); this.a(a); this.flags(a, 'Z0HC'); break; // ADD A, B
		case 0x81: a = this.a() + this.c(); this.a(a); this.flags(a, 'Z0HC'); break; // ADD A, C
		case 0x82: a = this.a() + this.d(); this.a(a); this.flags(a, 'Z0HC'); break; // ADD A, D
		case 0x85: a = this.a() + this.l(); this.a(a); this.flags(a, 'Z0HC'); break; // ADD A, L
		case 0x86: a = this.a() + this.hla(); this.flags(a, 'Z0HC'); this.a(a); break; // ADD A, (HL)
		case 0x87: a = this.a() * 2; this.flags(a, 'Z0HC'); this.a(a); break; // ADD A,A
		case 0xC6: a = this.a() + mmu.read(this.pc + 1); this.flags(a, 'Z0HC'); this.a(a); break; // ADD a, d8
		case 0xCE: a = this.a() + mmu.read(this.pc + 1) + this.f.c(); this.flags(a, 'Z0HC'); this.a(a); break; // ADC A,d8


		// 8-bit loads.
		case 0x06: this.b(mmu.read(this.pc + 1)); break; // LD B,d8
		case 0x16: this.d(mmu.read(this.pc + 1)); break; // LD D,d8
		case 0x26: this.h(mmu.read(this.pc + 1)); break; // LD H,d8
		case 0x36: mmu.write(this.hl, mmu.read(this.pc + 1)); break; // LD (HL),d8

		case 0x12: mmu.write(this.de, this.a()); break; // LD (DE), A
		case 0x22: mmu.write(this.hl, this.a()); this.hl = (this.hl + 1) & 0xFFFF; break; // LD (HL+),A
		case 0x32: mmu.write(this.hl, this.a()); this.hl = (this.hl - 1) & 0xFFFF; break; // LD (HL-),A

		case 0x0E: this.c(mmu.read(this.pc + 1)); break; // LD C,d8
		case 0x1E: this.e(mmu.read(this.pc + 1)); break; // LD E,d8
		case 0x2E: this.l(mmu.read(this.pc + 1)); break; // LD L,d8
		case 0x3A: this.a(this.hla()); this.hl = (this.hl - 1) & 0xFFFF; break; // LD A,(HL-)
		case 0x3E: this.a(mmu.read(this.pc + 1)); break; // LD A,d8

		case 0x40: break; // LD B,B
		case 0x41: this.b(this.c()); break; // LD B,C
		case 0x42: this.b(this.d()); break; // LD B,D
		case 0x43: this.b(this.e()); break; // LD B,E
		case 0x44: this.b(this.h()); break; // LD B,H
		case 0x45: this.b(this.l()); break; // LD B,L
		case 0x46: this.b(this.hla()); break; // LD B,(HL)
		case 0x47: this.b(this.a()); break; // LD B,A
		case 0x48: this.c(this.b()); break; // LD C,B
		case 0x49: break; // LD C,C
		case 0x4A: this.c(this.d()); break; // LD C,D
		case 0x4B: this.c(this.e()); break; // LD C,E
		case 0x4C: this.c(this.h()); break; // LD C,H
		case 0x4D: this.c(this.l()); break; // LD C,L
		case 0x4E: this.c(this.hla()); break; // LD C,(HL)
		case 0x4F: this.c(this.a()); break; // LD C,A
		case 0x50: this.d(this.b()); break; // LD D,B
		case 0x51: this.d(this.c()); break; // LD D,C
		case 0x52: break; // LD D,D
		case 0x53: this.e(this.e()); break; // LD D,E
		case 0x54: this.d(this.h()); break; // LD D,H
		case 0x55: this.d(this.l()); break; // LD D,L
		case 0x56: this.d(mmu.read(this.hl)); break; // LD D, (HL)
		case 0x57: this.d(this.a()); break; // LD D,A
		case 0x58: this.e(this.b()); break; // LD E,B
		case 0x59: this.e(this.c()); break; // LD E,C
		case 0x5A: this.e(this.d()); break; // LD E,D
		case 0x5B: break; // LD E,E
		case 0x5C: this.e(this.h()); break; // LD E,H
		case 0x5D: this.e(this.l()); break; // LD E,L
		case 0x5E: this.e(mmu.read(this.hl)); break; // LD E,(HL)
		case 0x5F: this.e(this.a()); break; // LD E,A
		case 0x60: this.h(this.b()); break; // LD H,B
		case 0x61: this.h(this.c()); break; // LD H,C
		case 0x62: this.h(this.d()); break; // LD H,D
		case 0x63: this.h(this.e()); break; // LD H,E
		case 0x64: break; // LD H, H
		case 0x65: this.h(this.l()); break; // LD H,L
		case 0x66: this.h(this.hla()); break; // LD H,(HL)
		case 0x67: this.h(this.a()); break; // LD H,A
		case 0x68: this.l(this.b()); break; // LD L,B
		case 0x69: this.l(this.c()); break; // LD L,C
		case 0x6A: this.l(this.d()); break; // LD L,D
		case 0x6B: this.l(this.e()); break; // LD L,E
		case 0x6C: this.l(this.h()); break; // LD L,H
		case 0x6D: break; // LD L, L ???
		case 0x6E: this.l(this.hla()); break; // LD L,(HL)
		case 0x6F: this.l(this.a()); break; // LD L,A
		case 0x70: this.hla(this.b()); break; // LD (HL),B
		case 0x71: this.hla(this.c()); break; // LD (HL),C
		case 0x72: this.hla(this.d()); break; // LD (HL), D
		case 0x73: this.hla(this.e()); break; // LD (HL),E
		case 0x74: this.hla(this.h()); break; // LD (HL), H
		case 0x75: this.hla(this.l()); break; // LD (HL),L
		case 0x77: this.hla(this.a()); break; // LD (HL),A
		case 0x78: this.a(this.b()); break; // LD A,B
		case 0x79: this.a(this.c()); break; // LD A,C
		case 0x7A: this.a(this.d()); break; // LD A,D
		case 0x7B: this.a(this.e()); break; // LD A,E
		case 0x7C: this.a(this.h()); break; // LD A,H
		case 0x7D: this.a(this.l()); break; // LD A,L
		case 0x7E: this.a(this.hla()); break; // LD A,(HL)
		case 0x7F: break; // LD A,A
		case 0x0A: this.a(mmu.read(this.bc)); break; // LD A, (BC)
		case 0x1A: this.a(mmu.read(this.de)); break; // LD A,(DE)

		case 0xE0: mmu.write(0xFF00 + mmu.read(this.pc + 1), this.a()); break; // LDH (a8),A
		case 0xF0: this.a(mmu.read(0xFF00 + mmu.read(this.pc + 1))); break; // LDH A,(a8)
		case 0xFA: this.a(mmu.read(mmu.readWord(this.pc + 1))); break; // LD A,(a16)

		// 16-bit loads.
		case 0x01: this.bc = mmu.readWord(this.pc + 1); break; // LD BC,d16
		case 0x08: mmu.writeWord(mmu.readWord(this.pc + 1), this.sp); break; // LD (a16), SP
		case 0x11: this.de = mmu.readWord(this.pc + 1); break; // LD DE,d16
		case 0x21: this.hl = mmu.readWord(this.pc + 1); break; // LD HL,d16
		case 0x31: this.sp = mmu.readWord(this.pc + 1); break; // LD SP,d16
		case 0xF9: this.sp = this.hl; break; // LD SP,HL


		case 0x2A: this.a(mmu.read(this.hl)); this.hl = (this.hl + 1) & 0xFFFF; break; // LD A,(HL+)

		case 0xE2: mmu.write(0xFF00 + this.c(), this.a()); break; // LD (C),A
		case 0xEA: mmu.write(mmu.readWord(this.pc + 1), this.a()); break; // LD (a16),A

		// 16-bit arithmetic.
		case 0x0B: this.bc = (this.bc - 1) & 0xFFFF; break; // DEC BC
		case 0x1B: this.de = (this.de - 1) & 0xFFFF; break; // DEC DE
		case 0x2B: this.hl = (this.hl - 1) & 0xFFFF; break; // DEC HL
		case 0x3B: this.sp = (this.sp - 1) & 0xFFFF; break; // DEC SP
		case 0x03: this.bc = (this.bc + 1) & 0xFFFF; break; // INC BC
		case 0x13: this.de = (this.de + 1) & 0xFFFF; break; // INC DE
		case 0x23: this.hl = (this.hl + 1) & 0xFFFF; break; // INC HL
		case 0x33: this.sp = (this.sp + 1) & 0xFFFF; break; // INC SP
		case 0x09: hl = this.hl + this.bc; this.flags(hl >>> 8, '-0HC'); this.hl = hl & 0xFFFF; break; // ADD HL,BC
		case 0x19: hl = this.hl + this.de; this.flags(hl >>> 8, '-0HC'); this.hl = hl & 0xFFFF; break; // ADD HL,DE
		case 0x29: hl = this.hl + this.hl; this.flags(hl >>> 8, '-0HC'); this.hl = hl & 0xFFFF; break; // ADD HL,HL
		case 0x39: hl = this.hl + this.sp; this.flags(hl >>> 8, '-0HC'); this.hl = hl & 0xFFFF; break; // ADD HL,SP

		// Flow control
		case 0x18: this.jump(mmu.read(this.pc + 1)); break; // JR r8
		case 0x28: if (this.f.z()) this.jump(mmu.read(this.pc + 1)); break; // JR C,r8
		case 0x38: if (this.f.c()) this.jump(mmu.read(this.pc + 1)); break; // JR C,r8
		case 0x20: if (!this.f.z()) this.jump(mmu.read(this.pc + 1)); break; // JR NZ,r8
		case 0x30: if (!this.f.c()) this.jump(mmu.read(this.pc + 1)); break; // JR NC,r8
		case 0xC3: this.pc = mmu.readWord(this.pc + 1); jmp = true; break; // JMP a16
		case 0xCA: if (this.f.z()) { this.pc = mmu.readWord(this.pc + 1); jmp = true; } break; // JP Z, a16
		case 0xE9: this.pc = this.hl; jmp = true; break; // JP (HL)
		case 0xC2: if (!this.f.z()) { this.pc = mmu.readWord(this.pc + 1); jmp = true; } break; // JP NZ,a16
		case 0xD2: if (!this.f.c()) { this.pc = mmu.readWord(this.pc + 1); jmp = true; } break; // JP NC,a16
		case 0xDA: if (this.f.c()) { this.pc = mmu.readWord(this.pc + 1); jmp = true; } break; // JP C, a16

		case 0xC4: jmp = this.call(!this.f.z()); break; // CALL NZ,a16
		case 0xCC: jmp = this.call(this.f.z()); break; // CALL Z,a16
		case 0xCD: jmp = this.call(true); break; // CALL a16
		case 0xD4: jmp = this.call(!this.f.c()); break; // CALL NC,a16
		case 0xDC: jmp = this.call(this.f.c()); break; // CALL C, a16
		case 0xC0: if (!this.f.z()) { this.pc = mmu.readWord(this.sp); this.sp += 2; jmp = true; } break;// RET NZ
		case 0xC8: if (this.f.z()) { this.pc = mmu.readWord(this.sp); this.sp += 2; jmp = true; } break; // RET Z
		case 0xC9:
			//console.log(hex(cpu.pc) + ': RET  sp=' + hex(this.sp));
			this.pc = mmu.readWord(this.sp); this.sp += 2; jmp = true; break; // RET
		case 0xD0: if (!this.f.c()) { this.pc = mmu.readWord(this.sp); this.sp += 2; jmp = true; } break; // RET NC
		case 0xD8: if (this.f.c()) { this.pc = mmu.readWord(this.sp); this.sp += 2; jmp = true; } break; // RET C
		case 0xD9: this.pc = mmu.readWord(this.sp); this.sp += 2; this.ime = true; jmp = true; break; // RETI

		// Pops and pushes.
		case 0xC5: this.sp -= 2; mmu.writeWord(this.sp, this.bc); break; // PUSH BC
		case 0xD5: this.sp -= 2; mmu.writeWord(this.sp, this.de); break; // PUSH DE
		case 0xE5: this.sp -= 2; mmu.writeWord(this.sp, this.hl); break; // PUSH HL
		case 0xF5: this.sp -= 2; mmu.writeWord(this.sp, this.af); break; // PUSH AF

		case 0xC1: this.bc = mmu.readWord(this.sp); this.sp += 2; break; // POP BC
		case 0xD1: this.de = mmu.readWord(this.sp); this.sp += 2; break; // POP DE
		case 0xE1: this.hl = mmu.readWord(this.sp); this.sp += 2; break; // POP HL
		case 0xF1: this.af = mmu.readWord(this.sp); this.sp += 2; break; // POP AF

		// Misc.
		case 0x17: a = this.a() << 1 | this.f.c(); this.flags(a, '000C'); this.a(a); break; // RLA
		case 0x37: this.flags(0, '-001'); break; // SCF (set carry flag).
		case 0x3F: this.af ^= 0x10; break; // CCF
		case 0x0: break; // NOP
		case 0xE8: sp = this.sp + mmu.read(this.pc + 1); this.flags(sp, '00HC'); this.sp = sp; break; // ADD SP,r8
		case 0xEE: a = this.a() ^ mmu.read(this.pc + 1); this.flags(a, 'Z000'); this.a(a); break; // XOR ED
		case 0xF3: this.ime = false; break; // DI
		case 0xFB: this.ime = true; break; // EI
		case 0xF8: hl = this.sp + mmu.read(this.pc + 1); this.flags(hl, '00HC'); this.hl = hl; break; // LD HL,SP+r8

		case 0xC7: mmu.writeWord(this.sp - 2, this.pc); this.pc = 0x00; jmp = true; break; // RST 00H
		case 0xCF: mmu.writeWord(this.sp - 2, this.pc); this.pc = 0x08; jmp = true; break; // RST 08H
		case 0xD7: mmu.writeWord(this.sp - 2, this.pc); this.pc = 0x10; jmp = true; break; // RST 10H
		case 0xDF: mmu.writeWord(this.sp - 2, this.pc); this.pc = 0x18; jmp = true; break; // RST 18H
		case 0xE7: mmu.writeWord(this.sp - 2, this.pc); this.pc = 0x20; jmp = true; break; // RST 20H
		case 0xEF: mmu.writeWord(this.sp - 2, this.pc); this.pc = 0x28; jmp = true; break; // RST 28H
		case 0xF7: mmu.writeWord(this.sp - 2, this.pc); this.pc = 0x30; jmp = true; break; // RST 30H
		case 0xFF: mmu.writeWord(this.sp - 2, this.pc); this.pc = 0x38; jmp = true; break; // RST 38H
		case 0x10: console.log('STOP'); this.halt = true; break;
		case 0x76: console.log('HALT'); break;

		case 0xCB: OpCodes.cb(this, mmu.read(this.pc + 1)); break; // CB OP

		// CB OpCodes. MOVE!!! ---------------------------------
		case 0xCB09:
			console.log('Warning: Likely wrong. Rotating through carry.')
			c = this.c();
			var fc = c & 0x1;
			c >>>= 1;
			this.flags(c, 'Z--' + fc);
			this.c(c);
			break; // CB RRC C

		case 0xCB11: c = this.c() << 1; this.flags(c, 'Z00C'); this.c(c); break; // CB RL C

		case 0xCB19:
			c = this.c();
			a = c & 0x1;
			c = (c >>> 1) | (this.f.c() ? 0x80 : 0);
			this.c(c);
			this.flags(c, 'Z00' + a);
			break; // CB RR C

		case 0xCB3F: a = this.a(); c = a & 0x1 ? 1 : 0; a >>>= 1; this.flags(a, 'Z00' + c); this.a(a); break; // SRL A
		case 0xCB38: b = this.b(); c = b & 0x1 ? 1 : 0; b >>>= 1; this.flags(b, 'Z00' + c); this.a(a); break; // SRL B

		case 0xCBB9: this.c(this.c() & 0x7F); break; // CB RES 7,C
		case 0xCBBF: this.a(this.a() & 0x7F); break; // CB RES 7,A
		case 0xCB7C: this.flags(cpu.h() & 0x80, 'Z01-'); break; // CB BIT 7,H

		case 0xCB5F: this.flags(cpu.a() & 0x08, 'Z01-'); break; // CB BIT 3,A
		case 0xCB7F: this.flags(cpu.a() & 0x80, 'Z01-'); break; // CB BIT 7,A

		case 0xCBDE: hl = mmu.readWord(this.hl); hl |= 0x8; mmu.writeWord(this.hl, hl); break; // CB SET 3,(HL)
		case 0xCBF9: c = this.c(); c |= 0x80; this.c(c); break; // CB SET 7,C

		case 0xCB27: a = this.a() << 1; this.flags(a, 'Z00C'); this.a(a); break; // CB SLA A
		case 0xCB37: a = (this.a() << 4 & 0xF0) | (this.a() >> 4 & 0xF); this.a(a); this.flags(a, 'Z000'); break; // SWAP
		// ---------------------------------------------------------------

		default:
			console.log(dbg.deasm());
			throw 'Error: Invalid OpCode 0x' + op.toString(16).toUpperCase() + ' @ 0x' + cpu.pc.toString(16).toUpperCase();

	}

	if (!jmp)
		this.pc += op <= 0xFF ? this.opCodeSizes[op] : 2;

	return cycles;
};

CPU.prototype.startRom = function() {
	this.af = 0x01B0;
	this.bc = 0x0013;
	this.de = 0x00D8;
	this.hl = 0x014D;
	this.sp = 0xFFFE;
	this.pc = 0x0100;
	this.mmu.booting = false;
};

CPU.prototype.opCodeSizes = [
	1,3,1,1,1,1,2,1,3,1,1,1,1,1,2,1,2,3,1,1,1,1,2,1,2,1,1,1,1,1,2,1,
	2,3,1,1,1,1,2,1,2,1,1,1,1,1,2,1,2,3,1,1,1,1,2,1,2,1,1,1,1,1,2,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,3,3,3,1,2,1,1,1,3,2,3,3,2,1,1,1,3,1,3,1,2,1,1,1,3,1,3,1,2,1,
	2,1,1,1,1,1,2,1,2,1,3,1,1,1,2,1,2,1,1,1,1,1,2,1,2,1,3,1,1,1,2,1
];

CPU.prototype.opCodeCycles = [
	4,12,8,8,4,4,8,4,20,8,8,8,4,4,8,4,4,12,8,8,4,4,8,4,12,8,8,8,4,4,8,4,
	12,12,8,8,4,4,8,4,12,8,8,8,4,4,8,4,12,12,8,8,12,12,12,4,12,8,8,8,4,4,8,4,
	4,4,4,4,4,4,8,4,4,4,4,4,4,4,8,4,4,4,4,4,4,4,8,4,4,4,4,4,4,4,8,4,
	4,4,4,4,4,4,8,4,4,4,4,4,4,4,8,4,8,8,8,8,8,8,4,8,4,4,4,4,4,4,8,4,
	4,4,4,4,4,4,8,4,4,4,4,4,4,4,8,4,4,4,4,4,4,4,8,4,4,4,4,4,4,4,8,4,
	4,4,4,4,4,4,8,4,4,4,4,4,4,4,8,4,4,4,4,4,4,4,8,4,4,4,4,4,4,4,8,4,
	20,12,16,16,24,16,8,16,20,16,16,4,24,24,8,16,20,12,16,0,24,16,8,16,20,16,16,0,24,0,8,16,
	12,12,8,0,0,16,8,16,16,4,16,0,0,0,8,16,12,12,8,4,0,16,8,16,12,8,16,4,0,0,8,16
];