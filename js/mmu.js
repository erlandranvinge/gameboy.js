
var MMU = function(gpu, spu, io) {
	this.booting = true;
	this.memory = [];
	this.gpu = gpu;
	this.spu = spu;
	this.io = io;
	this.log = false;

	for (var address = 0; address <= 0xFFFF; address++)
		this.memory[address] = 0x0;
};

MMU.prototype.read = function(address) {
	if (address >= 0xE000 && address <= 0xFE00)
		address -= 0x2000; // Memory repeat

	if (address <= 0xFF && this.booting) {
		return this.bootProgram[address];
	}

	if (address >= 0xFF10 && address <= 0xFF3F) // Sound unit.
		return this.spu.read(address);

	// TODO: Narrow down addresses here.
	if (address >= 0xFF40 && address < 0xFF46 ||
		address >= 0x8000 && address < 0xA000)
		return this.gpu.read(address);

	if (address == 0xFF00)
		return this.io.read(address);

	return this.memory[address];
};

var output = '';

MMU.prototype.write = function(address, data) {
	if (address >= 0xE000 && address <= 0xFE00)
		address -= 0x2000; // Memory repeat

	if (address < 0x8000) {
		throw 'Invalid write to ROM memory @ 0x' + address.toString(16).toUpperCase();
	}

	if (address >= 0xFF10 && address <= 0xFF3F) // Sound unit.
		return this.spu.write(address, data);


	// TODO: Narrow down addresses here.
	if (address >= 0xFF40 && address < 0xFF46 ||
		address >= 0x8000 && address < 0xA000) {
		this.gpu.write(address, data);
		return;
	}

	if (address == 0xFF00) {
		this.io.write(address, data);
		return;
	}

	if (address == 0xFF01) {
		//console.warn('POTENTIALLY BROKEN: ' + hex(data, 8) + '     ' + Debugger.opCodeNames[data]);
	}

	if (address == 0xFF83)
		return; //console.log('MEM WRITE');
	this.memory[address] = data;
};

MMU.prototype.readWord = function(address) {
	return (this.read(address + 1) << 8) | this.read(address);
};

MMU.prototype.writeWord = function(address, data) {
	var hi = (data >>> 8) & 0xFF;
	var low = data & 0xFF;
	this.write(address, low);
	this.write(address + 1, hi);
};

MMU.prototype.setCartridge = function(url) {
	var req = new XMLHttpRequest();
	req.open('GET', url, false);
	req.overrideMimeType('text/plain; charset=x-user-defined');
	req.send(null);
	if (req.status != 200)
		throw 'Error: Can\'t load ROM file: ' + url + '.';

	var rom = req.responseText;
	for (var address = 0; address < rom.length; address++) {
		this.memory[address] = rom.charCodeAt(address) & 0xFF;
	}

	this.header = {
		name: rom.substr(0x134, 16),
		color: rom.charCodeAt(0x143) ? true : false,
		sgb: rom.charCodeAt(0x146) === 0x3,
		type: rom.charCodeAt(0x147),
		romSize: rom.charCodeAt(0x0148),
		ramSize: rom.charCodeAt(0x0149)
	};
	console.log('Starting game: ' + this.header.name + ' type: ' + this.header.type);
};

MMU.prototype.bootProgram = [
	0x31, 0xFE, 0xFF, 0xAF, 0x21, 0xFF, 0x9F, 0x32, 0xCB, 0x7C, 0x20, 0xFB, 0x21, 0x26, 0xFF, 0x0E,
	0x11, 0x3E, 0x80, 0x32, 0xE2, 0x0C, 0x3E, 0xF3, 0xE2, 0x32, 0x3E, 0x77, 0x77, 0x3E, 0xFC, 0xE0,
	0x47, 0x11, 0x04, 0x01, 0x21, 0x10, 0x80, 0x1A, 0xCD, 0x95, 0x00, 0xCD, 0x96, 0x00, 0x13, 0x7B,
	0xFE, 0x34, 0x20, 0xF3, 0x11, 0xD8, 0x00, 0x06, 0x08, 0x1A, 0x13, 0x22, 0x23, 0x05, 0x20, 0xF9,
	0x3E, 0x19, 0xEA, 0x10, 0x99, 0x21, 0x2F, 0x99, 0x0E, 0x0C, 0x3D, 0x28, 0x08, 0x32, 0x0D, 0x20,
	0xF9, 0x2E, 0x0F, 0x18, 0xF3, 0x67, 0x3E, 0x64, 0x57, 0xE0, 0x42, 0x3E, 0x91, 0xE0, 0x40, 0x04,
	0x1E, 0x02, 0x0E, 0x0C, 0xF0, 0x44, 0xFE, 0x90, 0x20, 0xFA, 0x0D, 0x20, 0xF7, 0x1D, 0x20, 0xF2,
	0x0E, 0x13, 0x24, 0x7C, 0x1E, 0x83, 0xFE, 0x62, 0x28, 0x06, 0x1E, 0xC1, 0xFE, 0x64, 0x20, 0x06,
	0x7B, 0xE2, 0x0C, 0x3E, 0x87, 0xE2, 0xF0, 0x42, 0x90, 0xE0, 0x42, 0x15, 0x20, 0xD2, 0x05, 0x20,
	0x4F, 0x16, 0x20, 0x18, 0xCB, 0x4F, 0x06, 0x04, 0xC5, 0xCB, 0x11, 0x17, 0xC1, 0xCB, 0x11, 0x17,
	0x05, 0x20, 0xF5, 0x22, 0x23, 0x22, 0x23, 0xC9, 0xCE, 0xED, 0x66, 0x66, 0xCC, 0x0D, 0x00, 0x0B,
	0x03, 0x73, 0x00, 0x83, 0x00, 0x0C, 0x00, 0x0D, 0x00, 0x08, 0x11, 0x1F, 0x88, 0x89, 0x00, 0x0E,
	0xDC, 0xCC, 0x6E, 0xE6, 0xDD, 0xDD, 0xD9, 0x99, 0xBB, 0xBB, 0x67, 0x63, 0x6E, 0x0E, 0xEC, 0xCC,
	0xDD, 0xDC, 0x99, 0x9F, 0xBB, 0xB9, 0x33, 0x3E, 0x3C, 0x42, 0xB9, 0xA5, 0xB9, 0xA5, 0x42, 0x3C,
	0x21, 0x04, 0x01, 0x11, 0xA8, 0x00, 0x1A, 0x13, 0xBE, 0x20, 0xFE, 0x23, 0x7D, 0xFE, 0x34, 0x20,
	0xF5, 0x06, 0x19, 0x78, 0x86, 0x23, 0x05, 0x20, 0xFB, 0x86, 0x20, 0xFE, 0x3E, 0x01, 0xE0, 0x50
];
