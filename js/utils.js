
function bits(data, length) {
	length = length || 16;
	var result = '';
	while (length-- > 0)
		result += ((data & (1 << length)) ? '1': '0');
	return result;
}
