function getSuccessResponse(data, message){
    return {
        success: true,
        response: data,
        message
    }
}

function getErrorResponse(message, status){
    return {
        success: false,
        response: {},
        message,
        status: status
    }
}

function calculateAverage(numbers) {
    if (!numbers.length) return 0; // Проверяем, что массив не пустой
    const sum = numbers.reduce((acc, num) => acc + num, 0); // Суммируем элементы
    return Math.round(sum / numbers.length); // Делим сумму на количество элементов
}

function ukraineDate(date) {
    return new Date(date).toLocaleDateString('uk-UA', {
        timeZone: 'Europe/Kiev',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

module.exports = {getSuccessResponse, getErrorResponse, calculateAverage, ukraineDate}