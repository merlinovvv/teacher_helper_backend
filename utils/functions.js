function getSuccessResponse(data, message){
    return {
        success: true,
        response: data,
        message
    }
}

function getErrorResponse(message){
    return {
        success: false,
        response: {},
        message
    }
}

function calculateAverage(numbers) {
    if (!numbers.length) return 0; // Проверяем, что массив не пустой
    const sum = numbers.reduce((acc, num) => acc + num, 0); // Суммируем элементы
    return Math.round(sum / numbers.length); // Делим сумму на количество элементов
}

module.exports = {getSuccessResponse, getErrorResponse, calculateAverage}