
function hex(data, size) {
	size = (size || 16) / 4;
	var str = data.toString(16).toUpperCase();
	return '0000'.substr(0, size - str.length) + str;
}

function bits(data, size) {
	size = size || 16;
	var result = '';
	while (size-- > 0)
		result += ((data & (1 << size)) ? '1': '0');
	return result;
}

function signed(data) {
	return data & 0x80 ? data - 256 : data;
}

var Debugger = function(cpu, mmu, gpu) {
	this.cpu = cpu;
	this.mmu = mmu;
	this.gpu = gpu;
	this.history = [];
};

Debugger.prototype.regs = function(verbose) {
	var result;

	if (!verbose) {
		result = '';
		result += 'PC=' + hex(this.cpu.pc) + ', ';
		result += 'SP=' + hex(this.cpu.sp) + ', ';
		result += 'AF=' + hex(this.cpu.af) + ', ';
		result += 'BC=' + hex(this.cpu.bc) + ', ';
		result += 'DE=' + hex(this.cpu.de) + ', ';
		result += 'HL=' + hex(this.cpu.hl) + ', F=';
		result += this.cpu.f.z() ? 'Z' : '-';
		result += this.cpu.f.n() ? 'N' : '-';
		result += this.cpu.f.h() ? 'H' : '-';
		result += this.cpu.f.c() ? 'C' : '-';
		return result;
	}

	result = '';
	result += '_______________________________________________________________________________\n';
	result += '| PC: ' + hex(this.cpu.pc) + ' (' + bits(this.cpu.pc) + ')' +
		'\tSP: ' + hex(this.cpu.sp) + ' (' + bits(this.cpu.sp) + ')                 |\n';
	result += '| AF: ' + hex(this.cpu.af) + ' (' + bits(this.cpu.af) + ')' +
		'\tBC: ' + hex(this.cpu.bc) + ' (' + bits(this.cpu.bc) + ')' + '\t        ZNHC  |\n';
	result += '| DE: ' + hex(this.cpu.de) + ' (' + bits(this.cpu.de) + ')' +
		'\tHL: ' + hex(this.cpu.hl) + ' (' + bits(this.cpu.hl) + ')' +
		'\t Flags: ' + bits(this.cpu.af).substr(8, 4) + '  |\n';
	result += '|_____________________________________________________________________________|';
	return result;
};

Debugger.prototype.deasm = function(address) {
	if (address === undefined)
		address = this.cpu.pc;

	var pad = '                              ';
	var opCode = this.mmu.read(address);
	var size = this.cpu.opCodeSizes[opCode];
	var result = '';//(address == this.cpu.pc) ? '-> ' : '   ';

	result += hex(address) + ': ' + hex(opCode, 8);
	if (opCode === 0xCB || size > 1) {
		result += ' ' + hex(this.mmu.read(address + 1), 8);
		if (size > 2)
			result += ' ' + hex(this.mmu.read(address + 2), 8);
	}
	result += pad.substr(0, 25 - result.length) + ' | ';
	var inst = '';
	if (opCode !== 0xCB) {
		inst += Debugger.opCodeNames[opCode];
	} else {
		inst += 'CB ' + Debugger.cbOpCodeNames[this.mmu.read(address + 1)];
	}

	inst = inst.replace('a16', hex(this.mmu.readWord(address + 1)));
	inst = inst.replace('d8', hex(this.mmu.read(address + 1), 8));
	inst = inst.replace('a8', hex(this.mmu.read(address + 1), 8));
	inst = inst.replace('r8', signed(this.mmu.read(address + 1)));

	result = result + inst;
	result += pad.substr(0, 40 - result.length);
	return result;
};

Debugger.prototype.dump = function(address, length) {
	address = address || 0x0;
	length = length || 5;
	var result = '';
	for (var a = address; a < address + length; a++) {
		var data = this.mmu.read(a);
		result += hex(a) + ': ';
		result += hex(data, 8) + ' | ' + data + '\n';
	}
	console.log(result);
};

Debugger.prototype.trace = function() {
	this.history.push(this.deasm() + ' ' + this.regs());
	if (this.history.length > 1000)
		this.history.slice();
};

Debugger.prototype.recent = function(count) {
	count = count || 15;
	for (var i = this.history.length - count; i < this.history.length; i++) {
		console.log(this.history[i]);
	}
};

Debugger.prototype.step = function() {

	document.getElementById('af').innerHTML = hex(cpu.af);
	document.getElementById('bc').innerHTML = hex(cpu.bc);
	document.getElementById('de').innerHTML = hex(cpu.de);
	document.getElementById('hl').innerHTML = hex(cpu.hl);
	document.getElementById('sp').innerHTML = hex(cpu.sp);
	document.getElementById('pc').innerHTML = hex(cpu.pc);

	document.getElementById('lcdc').innerHTML = hex(gpu.control, 8);
	document.getElementById('stat').innerHTML = hex(gpu.stat, 8);
	document.getElementById('ly').innerHTML = hex(gpu.ly, 8);
	document.getElementById('cnt').innerHTML = gpu.cnt();
	document.getElementById('ie').innerHTML = hex(cpu.ie, 8);
	document.getElementById('if').innerHTML = hex(cpu.if, 8);


	document.getElementById('z').checked = cpu.f.z();
	document.getElementById('n').checked = cpu.f.n();
	document.getElementById('h').checked = cpu.f.h();
	document.getElementById('c').checked = cpu.f.c();

	document.getElementById('ime').innerHTML = cpu.ime;

};

Debugger.prototype.drawTiles = function(canvasId) {

	var base = this.gpu.control & 0x40 ? 0x8800 : 0x8000;
	var canvas = document.getElementById(canvasId);
	var ctx = canvas.getContext('2d');
	var palette = [210, 160, 128, 40];
	for (var tileY = 0; tileY < 16; tileY++) {
		for (var tileX = 0; tileX < 16; tileX++) {
			var address = base + tileY * 256 + tileX * 16;
			var tile = ctx.createImageData(8, 8);
			for (var line = 0; line < 8; line++) {
				var low = this.gpu.vram[address + line * 2];
				var hi = this.gpu.vram[address + line * 2 + 1];

				for (var bit = 0; bit < 8; bit++)
				{
					var mask = 1 << (7 - bit);
					var index = (low & mask ? 1 : 0) + (hi & mask ? 2 : 0);
					var color = palette[index]; //index == 3 ? 0 : 255;
					var offset = (bit + line * 8) * 4;
					tile.data[offset] = color;
					tile.data[offset+1] = color;
					tile.data[offset+2] = color;
					tile.data[offset+3] = 0xFF;
				}
			}
			ctx.putImageData(tile, tileX * 8, tileY * 8);
		}
	}
};

Debugger.opCodeNames = [
	'NOP', 'LD BC,d16', 'LD (BC),A', 'INC BC', 'INC B', 'DEC B', 'LD B,d8', 'RLCA', 'LD (a16),SP',
	'ADD HL,BC', 'LD A,(BC)', 'DEC BC', 'INC C', 'DEC C', 'LD C,d8', 'RRCA', 'STOP 0', 'LD DE,d16',
	'LD (DE),A', 'INC DE', 'INC D', 'DEC D', 'LD D,d8', 'RLA', 'JR r8', 'ADD HL,DE', 'LD A,(DE)',
	'DEC DE', 'INC E', 'DEC E', 'LD E,d8', 'RRA','JR NZ,r8', 'LD HL,d16', 'LD (HL+),A', 'INC HL',
	'INC H', 'DEC H', 'LD H,d8', 'DAA', 'JR Z,r8', 'ADD HL,HL', 'LD A,(HL+)', 'DEC HL', 'INC L',
	'DEC L', 'LD L,d8', 'CPL', 'JR NC,r8', 'LD SP,d16', 'LD (HL-),A', 'INC SP', 'INC (HL)', 'DEC (HL)',
	'LD (HL),d8', 'SCF', 'JR C,r8', 'ADD HL,SP', 'LD A,(HL-)', 'DEC SP', 'INC A', 'DEC A', 'LD A,d8',
	'CCF', 'LD B,B', 'LD B,C', 'LD B,D', 'LD B,E', 'LD B,H', 'LD B,L', 'LD B,(HL)', 'LD B,A', 'LD C,B',
	'LD C,C', 'LD C,D', 'LD C,E', 'LD C,H', 'LD C,L', 'LD C,(HL)', 'LD C,A', 'LD D,B', 'LD D,C', 'LD D,D',
	'LD D,E', 'LD D,H', 'LD D,L', 'LD D,(HL)', 'LD D,A', 'LD E,B', 'LD E,C', 'LD E,D', 'LD E,E', 'LD E,H',
	'LD E,L', 'LD E,(HL)', 'LD E,A', 'LD H,B', 'LD H,C', 'LD H,D', 'LD H,E', 'LD H,H', 'LD H,L', 'LD H,(HL)',
	'LD H,A', 'LD L,B', 'LD L,C', 'LD L,D', 'LD L,E', 'LD L,H', 'LD L,L', 'LD L,(HL)', 'LD L,A', 'LD (HL),B',
	'LD (HL),C', 'LD (HL),D', 'LD (HL),E', 'LD (HL),H', 'LD (HL),L', 'HALT', 'LD (HL),A', 'LD A,B', 'LD A,C',
	'LD A,D', 'LD A,E', 'LD A,H', 'LD A,L', 'LD A,(HL)', 'LD A,A', 'ADD A,B', 'ADD A,C', 'ADD A,D', 'ADD A,E',
	'ADD A,H', 'ADD A,L', 'ADD A,(HL)', 'ADD A,A', 'ADC A,B', 'ADC A,C', 'ADC A,D', 'ADC A,E', 'ADC A,H',
	'ADC A,L', 'ADC A,(HL)', 'ADC A,A', 'SUB B', 'SUB C', 'SUB D', 'SUB E', 'SUB H', 'SUB L', 'SUB (HL)',
	'SUB A', 'SBC A,B', 'SBC A,C', 'SBC A,D', 'SBC A,E', 'SBC A,H', 'SBC A,L', 'SBC A,(HL)', 'SBC A,A',
	'AND B', 'AND C', 'AND D', 'AND E', 'AND H', 'AND L', 'AND (HL)', 'AND A', 'XOR B', 'XOR C', 'XOR D',
	'XOR E', 'XOR H', 'XOR L', 'XOR (HL)', 'XOR A', 'OR B', 'OR C', 'OR D', 'OR E', 'OR H', 'OR L', 'OR (HL)',
	'OR A', 'CP B', 'CP C', 'CP D', 'CP E', 'CP H', 'CP L', 'CP (HL)', 'CP A', 'RET NZ', 'POP BC', 'JP NZ,a16',
	'JP a16', 'CALL NZ,a16', 'PUSH BC', 'ADD A,d8', 'RST 00H', 'RET Z', 'RET', 'JP Z,a16', 'PREFIX CB',
	'CALL Z,a16', 'CALL a16', 'ADC A,d8', 'RST 08H', 'RET NC', 'POP DE', 'JP NC,a16', '', 'CALL NC,a16',
	'PUSH DE', 'SUB d8', 'RST 10H', 'RET C', 'RETI', 'JP C,a16', '', 'CALL C,a16', '', 'SBC A,d8', 'RST 18H',
	'LDH (a8),A', 'POP HL', 'LD (C),A', '', '', 'PUSH HL', 'AND d8', 'RST 20H', 'ADD SP,r8', 'JP (HL)',
	'LD (a16),A', '', '', '', 'XOR d8', 'RST 28H', 'LDH A,(a8)', 'POP AF', 'LD A,(C)', 'DI', '', 'PUSH AF',
	'OR d8', 'RST 30H', 'LD HL,SP+r8', 'LD SP,HL', 'LD A,(a16)', 'EI', '', '', 'CP d8', 'RST 38H'];

Debugger.cbOpCodeNames = [
	'RLC B', 'RLC C', 'RLC D', 'RLC E', 'RLC H', 'RLC L', 'RLC (HL)', 'RLC A', 'RRC B', 'RRC C', 'RRC D',
	'RRC E', 'RRC H', 'RRC L', 'RRC (HL)', 'RRC A', 'RL B', 'RL C', 'RL D', 'RL E', 'RL H', 'RL L', 'RL (HL)',
	'RL A', 'RR B', 'RR C', 'RR D', 'RR E', 'RR H', 'RR L', 'RR (HL)', 'RR A', 'SLA B', 'SLA C', 'SLA D',
	'SLA E', 'SLA H', 'SLA L', 'SLA (HL)', 'SLA A', 'SRA B', 'SRA C', 'SRA D', 'SRA E', 'SRA H', 'SRA L',
	'SRA (HL)', 'SRA A', 'SWAP B', 'SWAP C', 'SWAP D', 'SWAP E', 'SWAP H', 'SWAP L', 'SWAP (HL)', 'SWAP A',
	'SRL B', 'SRL C', 'SRL D', 'SRL E', 'SRL H', 'SRL L', 'SRL (HL)', 'SRL A', 'BIT 0,B', 'BIT 0,C', 'BIT 0,D',
	'BIT 0,E', 'BIT 0,H', 'BIT 0,L', 'BIT 0,(HL)', 'BIT 0,A', 'BIT 1,B', 'BIT 1,C', 'BIT 1,D', 'BIT 1,E',
	'BIT 1,H', 'BIT 1,L', 'BIT 1,(HL)', 'BIT 1,A', 'BIT 2,B', 'BIT 2,C', 'BIT 2,D', 'BIT 2,E', 'BIT 2,H',
	'BIT 2,L', 'BIT 2,(HL)', 'BIT 2,A', 'BIT 3,B', 'BIT 3,C', 'BIT 3,D', 'BIT 3,E', 'BIT 3,H', 'BIT 3,L',
	'BIT 3,(HL)', 'BIT 3,A', 'BIT 4,B', 'BIT 4,C', 'BIT 4,D', 'BIT 4,E', 'BIT 4,H', 'BIT 4,L', 'BIT 4,(HL)',
	'BIT 4,A', 'BIT 5,B', 'BIT 5,C', 'BIT 5,D', 'BIT 5,E', 'BIT 5,H', 'BIT 5,L', 'BIT 5,(HL)', 'BIT 5,A',
	'BIT 6,B', 'BIT 6,C', 'BIT 6,D', 'BIT 6,E', 'BIT 6,H', 'BIT 6,L', 'BIT 6,(HL)', 'BIT 6,A', 'BIT 7,B',
	'BIT 7,C', 'BIT 7,D', 'BIT 7,E', 'BIT 7,H', 'BIT 7,L', 'BIT 7,(HL)', 'BIT 7,A', 'RES 0,B', 'RES 0,C',
	'RES 0,D', 'RES 0,E', 'RES 0,H', 'RES 0,L', 'RES 0,(HL)', 'RES 0,A', 'RES 1,B', 'RES 1,C', 'RES 1,D',
	'RES 1,E', 'RES 1,H', 'RES 1,L', 'RES 1,(HL)', 'RES 1,A', 'RES 2,B', 'RES 2,C', 'RES 2,D', 'RES 2,E',
	'RES 2,H', 'RES 2,L', 'RES 2,(HL)', 'RES 2,A', 'RES 3,B', 'RES 3,C', 'RES 3,D', 'RES 3,E', 'RES 3,H',
	'RES 3,L', 'RES 3,(HL)', 'RES 3,A','RES 4,B', 'RES 4,C', 'RES 4,D', 'RES 4,E', 'RES 4,H', 'RES 4,L',
	'RES 4,(HL)', 'RES 4,A', 'RES 5,B', 'RES 5,C', 'RES 5,D', 'RES 5,E', 'RES 5,H', 'RES 5,L', 'RES 5,(HL)',
	'RES 5,A', 'RES 6,B', 'RES 6,C', 'RES 6,D', 'RES 6,E', 'RES 6,H', 'RES 6,L', 'RES 6,(HL)', 'RES 6,A',
	'RES 7,B', 'RES 7,C', 'RES 7,D', 'RES 7,E', 'RES 7,H', 'RES 7,L', 'RES 7,(HL)', 'RES 7,A', 'SET 0,B',
	'SET 0,C', 'SET 0,D', 'SET 0,E', 'SET 0,H', 'SET 0,L', 'SET 0,(HL)', 'SET 0,A', 'SET 1,B', 'SET 1,C',
	'SET 1,D', 'SET 1,E', 'SET 1,H', 'SET 1,L', 'SET 1,(HL)', 'SET 1,A', 'SET 2,B', 'SET 2,C', 'SET 2,D',
	'SET 2,E', 'SET 2,H', 'SET 2,L', 'SET 2,(HL)', 'SET 2,A', 'SET 3,B', 'SET 3,C', 'SET 3,D', 'SET 3,E',
	'SET 3,H', 'SET 3,L', 'SET 3,(HL)', 'SET 3,A', 'SET 4,B', 'SET 4,C', 'SET 4,D', 'SET 4,E', 'SET 4,H',
	'SET 4,L', 'SET 4,(HL)', 'SET 4,A', 'SET 5,B', 'SET 5,C', 'SET 5,D', 'SET 5,E', 'SET 5,H', 'SET 5,L',
	'SET 5,(HL)', 'SET 5,A', 'SET 6,B', 'SET 6,C', 'SET 6,D', 'SET 6,E', 'SET 6,H', 'SET 6,L', 'SET 6,(HL)',
	'SET 6,A', 'SET 7,B', 'SET 7,C', 'SET 7,D', 'SET 7,E', 'SET 7,H', 'SET 7,L', 'SET 7,(HL)', 'SET 7,A'];