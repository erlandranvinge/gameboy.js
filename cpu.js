
var CPU = function(mmu) {
	this.frequency = 4194304; // ~4.194 MHz
	this.a = function() {}; this.f = function() {};
	this.b = function() {}; this.c = function() {};
	this.d = function() {}; this.e = function() {};
	this.h = function() {}; this.l = function() {};

	this.installRegister('af', 0x01B0);
	this.installRegister('bc', 0x0013);
	this.installRegister('de', 0x00D8);
	this.installRegister('hl', 0x014D);

	this.f = {};
	var self = this;
	this.f.z = function() { return self.af & 0x80 ? 1 : 0; };
	this.f.n = function() { return self.af & 0x40 ? 1 : 0; };
	this.f.h = function() { return self.af & 0x20 ? 1 : 0; };
	this.f.c = function() { return self.af & 0x10 ? 1 : 0; };

	this.pc = 0x0;
	this.sp = 0xFFFE;
	this.mmu = mmu;
	this.cycles = 0;
	this.expectedCycles = 0;
};

CPU.prototype.installRegister = function(name, value) {
	this[name] = value;
	this[name[0]] = function(value) {
		if (value === undefined) return (this[name] >>> 8) & 0xFF;
		this[name] = ((value & 0xFF) << 8) | (this[name] & 0xFF);
	};
	this[name[1]] = function(value) {
		if (value === undefined) return this[name] & 0xFF;
		this[name] = (value & 0xFF) | (this[name] & 0xFF00);
	};
};

CPU.prototype.flags = function(value, mask) {
	var result = [
		mask[0] === '1' || this.af & 0x80 ? 1 : 0,
		mask[1] === '1' || this.af & 0x40 ? 1 : 0,
		mask[2] === '1' || this.af & 0x20 ? 1 : 0,
		mask[3] === '1' || this.af & 0x10 ? 1 : 0];
	if (mask[0] === 'Z') result[0] = !(value & 0xFF) ? 1 : 0;
	if (mask[2] === 'H') result[2] = value & 0x10 ? 1 : 0;
	if (mask[3] === 'C') result[3] = value & 0x100 ? 1 : 0;
	var nibble = result[0] << 7 | result[1] << 6 | result[2] << 5 | result[3] << 4;
	this.af = (this.af & 0xFF0F) | nibble;
};

CPU.prototype.jump = function(address) {
	if (address & 0x80) address -= 256;
	this.pc += address;
};

CPU.prototype.step = function(dt) {
	this.expectedCycles += self.frequency * dt;
	if (this.cycles > this.expectedCycles) // Moving to fast?
		return;
	var op = this.mmu.read(this.pc);
	if (op === 0xCB) {
		op = 0xCB00 | this.mmu.read(this.pc + 1);
		this.cycles += 8;
	} else {
		this.cycles += this.opCodeCycles[op];
	}

	var mmu = this.mmu;
	var a = 0, r = 0, d = 0, c = 0;
	switch (op) {
		// 8-bit arithmetic.
		case 0x3D: this.a(this.a() - 1); this.flags(this.a(), 'Z1H-'); break; // DEC A
		case 0x05: this.b(this.b() - 1); this.flags(this.b(), 'Z1H-'); break; // DEC B
		case 0x0D: this.c(this.c() - 1); this.flags(this.c(), 'Z1H-'); break; // DEC C
		case 0x15: this.d(this.d() - 1); this.flags(this.d(), 'Z1H-'); break; // DEC D
		case 0x1D: this.e(this.e() - 1); this.flags(this.e(), 'Z1H-'); break; // DEC E

		case 0x04: this.b(this.b() + 1); this.flags(this.b(), 'Z0H-'); break; // INC B
		case 0x0C: this.c(this.c() + 1); this.flags(this.c(), 'Z0H-'); break; // INC C
		case 0x1C: this.e(this.e() + 1); this.flags(this.e(), 'Z0H-'); break; // INC E
		case 0x24: this.h(this.h() + 1); this.flags(this.h(), 'Z0H-'); break; // INC H

		// Unordered 8-bit arithmetic, please fix.
		case 0xA9: a = this.a() ^ this.c(); this.a(a); this.flags(a, 'Z000'); break; // XOR C
		case 0xAF: this.af = 0x80; break; // XOR A, A

		case 0xA1: r = this.a() & this.c(); this.a(r); this.flags(r, 'Z010'); break; // AND C
		case 0xA7: a = this.a() & this.a(); this.a(r); this.flags(a, 'Z010'); break; // AND A

		case 0xE6: r = this.a() & mmu.read(this.pc + 1); this.a(r); this.flags(r, 'Z010'); break; // AND d8

		case 0xB0: a = this.a() | this.b(); this.a(a); this.flags(a, 'Z000'); break; // OR B
		case 0xB1: a = this.a() | this.c(); this.a(a); this.flags(a, 'Z000'); break; // OR C
		case 0x90: a = this.a() - this.b(); this.flags(a, 'Z1HC'); this.a(a); break; // SUB B
		case 0x2F: a = ~this.a(); this.a(a); this.flags(a, '-NH-'); break; // CPL (complement A)
		case 0xFE: d = this.a() - mmu.read(this.pc + 1); this.flags(d, 'Z1HC'); break; // CP d8
		case 0xBE: d = this.a() - mmu.read(this.hl); this.flags(d, 'Z1HC'); break; // CP (HL)

		case 0x85: a = this.a() + this.l(); this.a(a); this.flags(a, 'Z0HC'); break; // ADD A, L
		case 0x86: a = this.a() + mmu.read(this.hl); this.flags(a, 'Z0HC'); this.a(a); break; // ADD A, (HL)

		// 8-bit loads.
		case 0x06: this.b(mmu.read(this.pc + 1)); break; // LD B,d8
		case 0x16: this.d(mmu.read(this.pc + 1)); break; // LD D,d8
		case 0x26: this.h(mmu.read(this.pc + 1)); break; // LD H,d8
		case 0x36: mmu.write(this.hl, mmu.read(this.pc + 1)); break; // LD (HL),d8
		case 0x56: this.d(mmu.read(this.hl)); break; // LD D, (HL)

		case 0x12: mmu.write(this.de, this.a()); break; // LD (DE), A
		case 0x22: mmu.write(this.hl, this.a()); this.hl = (this.hl + 1) & 0xFFFF; break; // LD (HL+),A
		case 0x32: mmu.write(this.hl, this.a()); this.hl = (this.hl - 1) & 0xFFFF; break; // LD (HL-),A


		case 0x0E: this.c(mmu.read(this.pc + 1)); break; // LD C,d8
		case 0x1E: this.e(mmu.read(this.pc + 1)); break; // LD E,d8
		case 0x2E: this.l(mmu.read(this.pc + 1)); break; // LD L,d8
		case 0x3E: this.a(mmu.read(this.pc + 1)); break; // LD A,d8
		case 0x5E: this.e(mmu.read(this.hl)); break; // LD E,(HL)
		case 0x7E: this.a(mmu.read(this.hl)); break; // LD A,(HL)

		case 0x47: this.b(this.a()); break; // LD B,A
		case 0x4F: this.c(this.a()); break; // LD C,A
		case 0x57: this.d(this.a()); break; // LD D,A
		case 0x5F: this.e(this.a()); break; // LD E,A
		case 0x67: this.h(this.a()); break; // LD H,A
		case 0x78: this.a(this.b()); break; // LD A,B
		case 0x79: this.a(this.c()); break; // LD A,C
		case 0x7B: this.a(this.e()); break; // LD A,E
		case 0x7C: this.a(this.h()); break; // LD A,H
		case 0x7D: this.a(this.l()); break; // LD A,L

		case 0x77: mmu.write(this.hl, this.a()); break; // LD (HL),A
		case 0x1A: this.a(mmu.read(this.de)); break; // LD A,(DE)

		case 0xE0: mmu.write(0xFF00 + mmu.read(this.pc + 1), this.a()); break; // LDH (a8),A
		case 0xF0: this.a(mmu.read(0xFF00 + mmu.read(this.pc + 1))); break; // LDH A,(a8)

		// 16-bit loads.
		case 0x01: this.bc = mmu.readWord(this.pc + 1); break; // LD BC,d16
		case 0x11: this.de = mmu.readWord(this.pc + 1); break; // LD DE,d16
		case 0x21: this.hl = mmu.readWord(this.pc + 1); break; // LD HL,d16
		case 0x31: this.sp = mmu.readWord(this.pc + 1); break; // LD SP,d16

		case 0x2A: this.a(mmu.read(this.hl)); this.hl = (this.hl + 1) & 0xFFFF; break; // LD A,(HL+)

		case 0xE2: mmu.write(0xFF00 + this.c(), this.a()); break; // LD (C),A
		case 0xEA: mmu.write(mmu.readWord(this.pc + 1), this.a()); break; // LD (a16),A

		// 16-bit arithmetic.
		case 0x0B: this.bc = (this.bc - 1) & 0xFFFF; break; // DEC BC
		case 0x1B: this.de = (this.de - 1) & 0xFFFF; break; // DEC DE

		case 0x03: this.bc = (this.bc + 1) & 0xFFFF; break; // INC BC
		case 0x13: this.de = (this.de + 1) & 0xFFFF; break; // INC DE
		case 0x23: this.hl = (this.hl + 1) & 0xFFFF; break; // INC HL

		case 0x19: r = this.hl + this.de; this.hl = r & 0xFFFF; this.flags(r >>> 8, '-0HC'); break; // ADD HL,DE
		case 0x29: r = this.hl + this.hl; this.hl = r & 0xFFFF; this.flags(r >>> 8, '-0HC'); break; // ADD HL,HL


		// Flow control
		case 0x18: this.jump(mmu.read(this.pc + 1)); break; // JR r8
		case 0xE9: this.pc = this.hl; break; // JP (HL)
		case 0x20: if (!this.f.z()) this.jump(mmu.read(this.pc + 1)); break; // JR NZ,r8
		case 0x30: if (!this.f.c()) this.jump(mmu.read(this.pc + 1)); break; // JR NC,r8

		case 0x28: if (this.f.z()) this.jump(mmu.read(this.pc + 1)); break; // JR Z,r8
		case 0xC3: this.pc = mmu.readWord(this.pc + 1); return; // JMP a16

		case 0xCD: // CALL a16
			mmu.writeWord(this.sp -= 2, this.pc + 3);
			this.pc = mmu.readWord(this.pc + 1);
			return;
		case 0xC9: this.pc = mmu.readWord(this.sp); this.sp += 2; return; // RET
		case 0xC5: mmu.writeWord(this.sp -= 2, this.bc); break; // PUSH BC
		case 0xD5: mmu.writeWord(this.sp -= 2, this.de); break; // PUSH DE

		case 0xC1: this.bc = mmu.readWord(this.sp); this.sp += 2; break; // POP BC
		case 0xE1: this.hl = mmu.readWord(this.sp); this.sp += 2; break; // POP HL

		// Misc.
		case 0x17: a = this.a() << 1 | this.f.c(); this.flags(a, '000C'); this.a(a); break; // RLA
		case 0x0: break; // NOP
		case 0xF3: break; // DI
		case 0xFB: break; // EI
		case 0xEF: mmu.writeWord(this.sp - 2, this.pc); this.pc = 0x28; break; // RST 28H
		case 0xFF: mmu.writeWord(this.sp - 2, this.pc); this.pc = 0x38; break; // RST 38H

		// CB OpCodes
		case 0xCB11: c = this.c() << 1; this.flags(c, 'Z00C'); this.c(c); break; // RL C
		case 0xCB7C: this.flags(cpu.h() & 0x80, 'Z01-'); break; // BIT 7,H
		case 0xCB37: a = (this.a() << 4 & 0xF0) | (this.a() >> 4 & 0xF); this.a(a); this.flags(a, 'Z000'); break; // SWAP
		default:
			throw 'Error: Invalid OpCode 0x' + op.toString(16).toUpperCase() + ' @ 0x' +
			cpu.pc.toString(16).toUpperCase();
	}
	this.pc += op <= 0xFF ? this.opCodeSizes[op] : 2;
};

CPU.prototype.startRom = function() {
	this.af = 0x1;
	this.bc = 0x13;
	this.de = 0xD8;
	this.hl = 0x14D;
	this.sp = 0xFFFE;
	this.pc = 0x0;
	this.mmu.booting = true;
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