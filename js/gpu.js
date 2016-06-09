
var Display = function(gpu, canvasId) {
	this.gpu = gpu;
	this.canvas = document.getElementById(canvasId);
	if (!this.canvas)
		throw 'Error: Missing canvas element.';
	this.context = this.canvas.getContext('2d');
	this.context.imageSmoothingEnabled = false;
	this.buffer = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
	console.info('Display (%f, %f) attached.', this.canvas.width, this.canvas.height);
};

Display.prototype.scanline = function() {
	var control = this.gpu.control;
	var y = this.gpu.ly;
	var screen = this.buffer.data;

	for (var x = 0; x < 160; x++) {
		var tileX = x >> 3;
		var tileY = y >> 3;

		var index = this.gpu.vram[0x9800 + 32 * tileY + tileX];
		var line = y - tileY * 8;
		var bit = x - tileX * 8;

		var address = 0x8000 + index * 16;//+ tileY * 512 + tileX * 16;
		var palette = [255, 200, 128, 40];

		var low = this.gpu.vram[address + line * 2];
		var hi = this.gpu.vram[address + line * 2 + 1];

		var px = tileX * 8 + bit;
		var py = tileY * 8 + line;
		var mask = 1 << (7 - bit);
		var index = (low & mask ? 1 : 0) + (hi & mask ? 2 : 0);
		var color = palette[index]; //index == 3 ? 0 : 255;

		var da = (y * 160 + x) * 4;
		screen[da] = color;
		screen[da + 1] = color;
		screen[da + 2] = color;
		screen[da + 3] = 0xFF;
	}
};

Display.prototype.blit = function() {
	this.context.putImageData(this.buffer, 0, 0);
	//console.log('BLIT!');
};

var GPUMode = { hBlank: 0, vBlank: 1, oamRead: 2, transfer: 3 };

var GPU = function(canvasId) {
	this.display = new Display(this, canvasId);
	this.vram = [];
	this.modeCycle = 0;
	this.mode = 1;
	this.ly = 0x0;
	this.lyc = 0x0;
	this.control = 0x91;
	this.stat = 0x85;
	this.scy = 0;
	this.scx = 0;

	for (var i = 0; i < 0xFFFF; i++)
		this.vram[i] = 0x0;
};

GPU.prototype.cnt = function() {
	switch(this.mode) {
		case GPUMode.hBlank: return 204 - this.modeCycle;
		case GPUMode.vBlank: return 456 - this.modeCycle;
		case GPUMode.oamRead: return 80 - this.modeCycle;
		case GPUMode.transfer: return 173 - this.modeCycle;
	}
};

GPU.prototype.step = function(cycles) {
	switch(this.mode) {
		case GPUMode.hBlank:
			if (this.modeCycle >= 204) {
				this.modeCycle = -cycles;
				this.ly++;
				if (this.ly == 144) {
					this.mode = GPUMode.vBlank;
					this.cpu.interrupt(Interrupt.vBlank);
					this.display.blit();
				} else {
					this.mode = GPUMode.oamRead;
				}
			}
			break;
		case GPUMode.vBlank:
			if (this.modeCycle >= 456) {
				this.modeCycle = -cycles;
				this.ly++;
				if (this.ly > 153) {
					this.mode = GPUMode.oamRead;
					this.ly = 0;
				}
			}
			break;
		case GPUMode.oamRead:
			if (this.modeCycle >= 80) {
				this.mode = GPUMode.transfer;
				this.modeCycle = -cycles;
			}
			break;
		case GPUMode.transfer: // Transfer
			if (this.modeCycle >= 173) {
				this.mode = GPUMode.hBlank;
				this.modeCycle = -cycles;
				this.display.scanline();
			}
			break;
	}
	this.stat = this.stat & 0xFC | this.mode;
	this.modeCycle += cycles;
};

GPU.prototype.read = function(address) {

	if (address >= 0x8000 && address <= 0x9FFF) {
		return this.vram[address];
	}

	switch(address) {
		case 0xFF40: return this.control;
		case 0xFF41: return this.stat;
		case 0xFF42: return this.scy;
		case 0xFF43: return this.scx;
		case 0xFF44: return this.ly;
		case 0xFF45: return this.lyc;
		default:
			throw 'Error: Invalid GPU read from 0x' + address.toString(16).toUpperCase() + '.';
	}
};

GPU.prototype.write = function(address, data) {

	if (address >= 0x8000 && address <= 0x9FFF) {
		this.vram[address] = data;
		return;
	}

	switch(address) {
		case 0xFF40:
			//console.log('LCD Control:', bits(data, 8));
			this.control = data;
			break;
		case 0xFF41:
			//console.log('LCD STAT: ', bits(data, 8));
			this.stat = (this.stat & 0x8F) | (data & 0x70);
			break;
		case 0xFF42: this.scy = data; break;
		case 0xFF43: this.scx = data; break;
		case 0xFF44: this.ly = 0; break;
		case 0xFF45: this.lyc = data; break;
		default:
			console.warn('Warning: Invalid GPU write to 0x' + address.toString(16).toUpperCase());
	}
};
