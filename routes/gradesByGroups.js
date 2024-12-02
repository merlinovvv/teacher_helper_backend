const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const Subjects = require('../models/Subjects');
const Classes = require('../models/Classes');
const Groups = require('../models/Groups');
const User = require('../models/User');
const GradesGroupsReports = require('../models/GradesGroupsReports');
const authenticate = require('../middleware/authenticate');
const { getSuccessResponse, getErrorResponse, calculateAverage, ukraineDate } = require("../utils/functions");

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Указываем папку, куда будет сохранен файл
        const uploadPath = path.join(__dirname, '../uploads/');

        // Проверка, существует ли папка, если нет — создание
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true }); // { recursive: true } для создания вложенных папок
        }

        cb(null, uploadPath);
    },
    filename: async function (req, file, cb) {
        const { subject, schoolClass } = req.query;
        const userId = req.user.id
        const { type_report } = await User.findById(userId);
        cb(null, `${userId}_${subject}_${schoolClass}_${type_report}.xlsx`); // 'custom_name_' + уникальный суффикс
    }
});

const upload = multer({ storage: storage });

const router = express.Router();

router.get('/subjects', authenticate, async (req, res) => {
    const subjects = await Subjects.find({ userId: req?.user.id });

    try {
        res.status(200).json(getSuccessResponse({ subjects }));
    } catch (err) {
        res.status(500).json(getErrorResponse('Помилка отримання предметів'));
    }
});

router.post('/subjects', authenticate, async (req, res) => {
    const { name } = req.body;
    const subject = new Subjects({ name, userId: req.user.id });
    await subject.save();

    try {
        res.status(200).json(getSuccessResponse({}, `Предмет ${name} успішно додано!`));
    } catch (err) {
        res.status(500).json(getErrorResponse('Помилка збереження прдметів'));
    }
});

router.delete('/subjects', authenticate, async (req, res) => {
    const { _id } = req.query;

    try {
        const existingSubject = await Subjects.findById(_id);

        if (!existingSubject) {
            return res.status(404).json(getErrorResponse('Предмет не знайдений'));
        }

        await Subjects.findByIdAndDelete(_id);

        res.status(200).json(getSuccessResponse({}, `Предмет "${existingSubject?.name}" успішно видалений!`));
    } catch (err) {
        res.status(500).json(getErrorResponse('Помилка видалення предмету'));
    }
});

router.get('/classes', authenticate, async (req, res) => {
    const classes = await Classes.find({ userId: req?.user.id });

    try {
        res.status(200).json(getSuccessResponse({ classes }));
    } catch (err) {
        res.status(500).json(getErrorResponse('Помилка отримання класів'));
    }
});

router.post('/classes', authenticate, async (req, res) => {
    const { name, _id } = req.body;

    try {
        const existingClass = await Classes.findById(_id);
        console.log(existingClass);

        if (existingClass) {
            await Classes.findOneAndUpdate(
                { _id },
                { name },
                { upsert: true, new: true }
            );

            res.status(200).json(getSuccessResponse({}, `${name} успішно оновлений!`));
        } else {
            const classes = new Classes({ name, userId: req.user.id });
            await classes.save();

            res.status(200).json(getSuccessResponse({}, `${name} успішно доданий!`));
        }

    } catch (err) {
        console.log(err);

        res.status(500).json(getErrorResponse('Помилка збереження класів'));
    }
});

router.delete('/classes', authenticate, async (req, res) => {
    const { _id } = req.query;

    try {
        // Проверяем, существует ли класс
        const existingClass = await Classes.findById(_id);

        if (!existingClass) {
            return res.status(404).json(getErrorResponse('Клас не знайдений'));
        }

        // Удаляем класс
        await Classes.findByIdAndDelete(_id);

        res.status(200).json(getSuccessResponse({}, `${existingClass?.name} успішно видалений!`));
    } catch (err) {
        res.status(500).json(getErrorResponse('Помилка видалення класу'));
    }
});

router.post('/groups', authenticate, async (req, res) => {
    const groupsArray = req.body; // Массив объектов

    try {
        const results = [];

        // Извлекаем все `subject` и `schoolClass` из body
        const newLinks = groupsArray.map(({ subject, schoolClass }) => ({
            subject,
            schoolClass,
        }));

        // Получаем текущие записи пользователя из базы
        const existingLinks = await Groups.find({ userId: req.user.id }, 'subject schoolClass').lean();

        // Находим записи, которые нужно удалить (есть в базе, но не пришли в body)
        const linksToDelete = existingLinks.filter(
            (link) => !newLinks.some(
                (newLink) =>
                    String(newLink.subject) === String(link.subject) &&
                    String(newLink.schoolClass) === String(link.schoolClass)
            )
        );

        // Удаляем записи, которые отсутствуют в новом массиве
        if (linksToDelete.length > 0) {
            const deleteCriteria = linksToDelete.map(({ subject, schoolClass }) => ({
                userId: req.user.id, // Ограничение по пользователю
                subject,
                schoolClass,
            }));
            await Groups.deleteMany({ $or: deleteCriteria });
        }

        // Обрабатываем или создаем новые записи
        for (const groupData of groupsArray) {
            const { subject, schoolClass, groups } = groupData;

            // Проверяем, существует ли указанный Subject и Class
            const subjectExists = await Subjects.findById(subject);
            const classesExists = await Classes.findById(schoolClass);

            if (!subjectExists) {
                return res.status(404).json(getErrorResponse(`Предмет не знайдений: ${subject}`));
            }

            if (!classesExists) {
                return res.status(404).json(getErrorResponse(`Клас не знайдений: ${schoolClass}`));
            }

            // Обновляем или создаем запись
            const updatedGroup = await Groups.findOneAndUpdate(
                { subject, schoolClass, userId: req.user.id },
                { subject, schoolClass, groups, userId: req.user.id }, // Убедитесь, что userId сохраняется
                { upsert: true, new: true }
            );

            results.push(updatedGroup);
        }

        res.status(200).json(getSuccessResponse({ results }, 'Групи оцінок успішно оновлені'));
    } catch (err) {
        res.status(500).json(getErrorResponse('Помилка оновлення групи оцінок'));
    }
});

router.get('/groups', authenticate, async (req, res) => {
    try {
        const groups = await Groups.find({ userId: req?.user.id });

        res.status(201).json(getSuccessResponse({ groups }));
    } catch (err) {
        console.error('Error creating groups:', err);
        res.status(500).json(getErrorResponse('Помилка створення груп'));
    }
});

router.post('/report', authenticate, upload.single('file'), async (req, res) => {
    const { subject, schoolClass } = req.query;
    const userId = req.user.id

    const { type_report } = await User.findById(req.user.id);

    if (!type_report) {
        res.status(401).json(getErrorResponse(`Помилка! Встановіть тип звітів в налаштуваннях!`));
    }

    const existingGradesGroupsReports = await GradesGroupsReports.findOne({ subject, schoolClass, userId, reportType: type_report });

    if (existingGradesGroupsReports) {
        await GradesGroupsReports.findOneAndUpdate(
            { subject, schoolClass, userId, reportType: type_report },
            { subject, schoolClass, userId, reportType: type_report },
            { upsert: true, new: true }
        );

        res.status(200).json(getSuccessResponse({}, `Звіт успішно оновлений!`));
    } else {
        const gradesGroupsReports = new GradesGroupsReports({ subject, schoolClass, userId, reportType: type_report });
        await gradesGroupsReports.save();

        res.status(200).json(getSuccessResponse({}, `Звіт успішно доданий!`));
    }
});

router.get('/report', authenticate, async (req, res) => {
    const { _id } = req.query

    const existingGradesGroupsReports = await GradesGroupsReports.findById(_id);

    if (existingGradesGroupsReports) {
        const { userId, subject, schoolClass, reportType } = existingGradesGroupsReports

        try {
            const filePath = path.join(__dirname, `../uploads/${userId}_${subject}_${schoolClass}_${reportType}.xlsx`);
            const currentClassName = await Classes.findById(schoolClass)
            const currentSubject = await Subjects.findById(subject)

            // Проверим, существует ли файл
            if (!fs.existsSync(filePath)) {
                return res.status(404).json(getErrorResponse('Файл не знайдено'));
            }

            // Читаем файл с помощью библиотеки xlsx
            const workbook = xlsx.readFile(filePath);
            let names = {};
            let report = []
            const { groups } = await Groups.findOne({ subject, schoolClass });

            switch (reportType) {
                case 'human':
                    for (let listNum = 0; listNum < workbook.SheetNames?.length; listNum++) {
                        // Предполагаем, что нам нужен первый лист (можно изменить по необходимости)
                        const sheetName = workbook.SheetNames[listNum];
                        let file = workbook.Sheets[sheetName];

                        const ignoreTypes = ['Відвідуваність', 'Завдання', 'Зошит'];

                        for (let key in file) {
                            const [currentColumn, currentRow] = key.match(/[A-Za-z]+|[0-9]+/g);
                            const rowNumber = Number(currentRow);
                            if (rowNumber >= 4 && key.includes('A') && Number.isInteger(Number(key[1]))) {
                                if (!names[key]) {
                                    names[key] = {
                                        name: file[key]['v'],
                                        ratings: []  // сразу добавляем пустой массив для рейтингов
                                    };
                                }

                            }

                            const rowKey = 'A' + rowNumber;
                            if (names[rowKey] && currentColumn !== 'A') {
                                const type = file[currentColumn + '3']?.['v'];
                                const date = file[currentColumn + '2']?.['v'];
                                const rating = Number.isInteger(Number(file[key]?.['v'])) ? Number(file[key]?.['v']) : '';

                                if (!ignoreTypes.includes(type) && rating) {
                                    names[rowKey].ratings.push({ type: type || '', rating: rating, date: date || '' });
                                }
                            }
                        }
                    }

                    const normalReportHuman = Object.values(names).map(({ name, ratings = [] }) => ({
                        name,
                        ratings: ratings.map(({ date, rating }) => {
                            const [day, month, year] = date.split('/').map(Number);

                            return {
                                rating: rating,
                                date: date ? ukraineDate(new Date(year, month - 1, day)) : ''
                            };
                        })
                    }));

                    report = normalReportHuman.map(student => {
                        let avgAllGroups = [];

                        return {
                            name: student.name,
                            groups: groups.map(group => {

                                // Фильтруем оценки, соответствующие датам в группе
                                const relevantRatings = student.ratings.filter(({ date }) => {
                                    const dateInGroup = date => {
                                        const parsedDate = date;
                                        return group.assigment_dates.some(gDate => parsedDate === ukraineDate(gDate)) ||
                                            group.control_dates.some(gDate => parsedDate === ukraineDate(gDate));
                                    };
                                    return dateInGroup(date);
                                });

                                // Разделяем оценки по типам
                                const assigments = relevantRatings.filter(({ date }) => {
                                    return group.assigment_dates.some((b_date) => ukraineDate(b_date) === date)
                                });
                                const controls = relevantRatings.filter(({ date }) => group.control_dates.some((b_date) => ukraineDate(b_date) === date));

                                const assigmentsAvg = assigments.reduce((sum, { rating }) => sum + (Number(rating) || 0), 0) / (assigments.length || 1);
                                const controlsAvg = controls.reduce((sum, { rating }) => sum + (Number(rating) || 0), 0) / (controls.length || 1);

                                let groupAvg = controls.length ? Math.round((assigmentsAvg + controlsAvg) / 2) : Math.round(assigmentsAvg);

                                if (!controls.length && assigments?.length) {
                                    groupAvg = Math.round(assigmentsAvg)
                                } else if (!assigments?.length && controls.length) {
                                    groupAvg = Math.round(controlsAvg)
                                } else if (controls.length && assigments?.length) {
                                    groupAvg = Math.round((assigmentsAvg + controlsAvg) / 2)
                                }

                                if (groupAvg === 0) {
                                    groupAvg = ''
                                } else {
                                    avgAllGroups.push(groupAvg)
                                }

                                return {
                                    group: group.name,
                                    assigments: [...assigments, { rating: Math.round(assigmentsAvg), type: 'Середня', date: '' }],
                                    controls: [...controls, { rating: Math.round(controlsAvg), type: 'Середня', date: '' }],
                                    groupAvg
                                };
                            }),
                            avg_groups: calculateAverage(avgAllGroups)
                        };
                    });
                    break;
                case "novi_znannya":
                    for (let listNum = 0; listNum < workbook.SheetNames?.length; listNum++) {
                        // Предполагаем, что нам нужен первый лист (можно изменить по необходимости)
                        const sheetName = workbook.SheetNames[listNum];
                        let file = workbook.Sheets[sheetName];

                        const ignoreTypes = ['Відвідуваність', 'Завдання', 'Зошит', 'Тем', 'Ceм', 'Cк', '1', '2', '3', 'Річ'];

                        for (let key in file) {
                            const [currentColumn, currentRow] = key.match(/[A-Za-z]+|[0-9]+/g);
                            const rowNumber = Number(currentRow);
                            if (rowNumber >= 3 && key.includes('B') && Number.isInteger(Number(key[1]))) {
                                if (!names[key]) {
                                    names[key] = {
                                        name: file[key]['v'],
                                        ratings: []  // сразу добавляем пустой массив для рейтингов
                                    };
                                }

                            }

                            const rowKey = 'B' + rowNumber;
                            if (names[rowKey] && currentColumn !== 'B') {
                                const type = file[currentColumn + '2']?.['v'];
                                const date = file[currentColumn + '1']?.['v'];
                                const rating = Number.isInteger(Number(file[key]?.['v'])) ? Number(file[key]?.['v']) : '';

                                if (!ignoreTypes.includes(type) && rating) {
                                    names[rowKey].ratings.push({ type: type || '', rating: rating, date: date || '' });
                                }
                            }
                        }
                    }

                    const currentYear = new Date().getFullYear();

                    // Функция для определения года
                    const determineYear = (month) => {
                        // Если месяц больше текущего месяца, предположим, что это предыдущий год
                        const currentMonth = new Date().getMonth() + 1;
                        return month > currentMonth ? currentYear - 1 : currentYear;
                    };

                    const normalReportNovyZnannya = Object.values(names).map(({ name, ratings = [] }) => ({
                        name,
                        ratings: ratings.map(({ date, rating }) => {
                            const [day, month] = date.split('/').map(Number);
                            const year = determineYear(month);

                            return {
                                rating,
                                date: date ? ukraineDate(new Date(year, month - 1, day)) : ''
                            };
                        })
                    }));
                    
                    report = normalReportNovyZnannya.map(student => {
                        let avgAllGroups = [];

                        return {
                            name: student.name,
                            groups: groups.map(group => {

                                // Фильтруем оценки, соответствующие датам в группе
                                const relevantRatings = student.ratings.filter(({ date }) => {
                                    const dateInGroup = date => {
                                        const parsedDate = date;
                                        return group.assigment_dates.some(gDate => parsedDate === ukraineDate(gDate)) ||
                                            group.control_dates.some(gDate => parsedDate === ukraineDate(gDate));
                                    };
                                    return dateInGroup(date);
                                });

                                // Разделяем оценки по типам
                                const assigments = relevantRatings.filter(({ date }) => {
                                    return group.assigment_dates.some((b_date) => ukraineDate(b_date) === date)
                                });
                                const controls = relevantRatings.filter(({ date }) => group.control_dates.some((b_date) => ukraineDate(b_date) === date));

                                const assigmentsAvg = assigments.reduce((sum, { rating }) => sum + (Number(rating) || 0), 0) / (assigments.length || 1);
                                const controlsAvg = controls.reduce((sum, { rating }) => sum + (Number(rating) || 0), 0) / (controls.length || 1);

                                let groupAvg = controls.length ? Math.round((assigmentsAvg + controlsAvg) / 2) : Math.round(assigmentsAvg);

                                if (!controls.length && assigments?.length) {
                                    groupAvg = Math.round(assigmentsAvg)
                                } else if (!assigments?.length && controls.length) {
                                    groupAvg = Math.round(controlsAvg)
                                } else if (controls.length && assigments?.length) {
                                    groupAvg = Math.round((assigmentsAvg + controlsAvg) / 2)
                                }

                                if (groupAvg === 0) {
                                    groupAvg = ''
                                } else {
                                    avgAllGroups.push(groupAvg)
                                }

                                return {
                                    group: group.name,
                                    assigments: [...assigments, { rating: Math.round(assigmentsAvg), type: 'Середня', date: '' }],
                                    controls: [...controls, { rating: Math.round(controlsAvg), type: 'Середня', date: '' }],
                                    groupAvg
                                };
                            }),
                            avg_groups: calculateAverage(avgAllGroups)
                        };
                    });
                    break;
                default:
                    break;
            }

            res.status(200).json(getSuccessResponse({
                report,
                groups,
                schoolClass: currentClassName?.name,
                subject: currentSubject?.name,
                reportType
            }));
        } catch (err) {
            res.status(500).json(getErrorResponse('Сталася помилка при отриманні звіту'));
        }
    } else {
        res.status(404).json(getErrorResponse('Звіт не знайдено'));
    }
});

router.delete('/report', authenticate, async (req, res) => {
    const { _id } = req.query;

    try {
        // Проверяем, существует ли класс
        const existingGradesGroupsReports = await GradesGroupsReports.findById(_id);

        if (!existingGradesGroupsReports) {
            return res.status(404).json(getErrorResponse('Звіт не знайдено'));
        }

        // Удаляем класс
        await GradesGroupsReports.findByIdAndDelete(_id);

        const { userId, subject, schoolClass, reportType } = existingGradesGroupsReports

        const filePath = `uploads/${userId}_${subject}_${schoolClass}_${reportType}.xlsx`;

        if (fs.existsSync(filePath)) {
            await fs.unlink(filePath, (err) => {
                if (err) {
                    res.status(500).json(getErrorResponse('Помилка видалення звіту'));
                }
            });
        }

        res.status(200).json(getSuccessResponse({}, `Звіт успішно видалений!`));
    } catch (err) {
        res.status(500).json(getErrorResponse('Помилка видалення звіту'));
    }
});

router.get('/reports', authenticate, async (req, res) => {
    try {
        const reports = await GradesGroupsReports.find({ userId: req.user.id })
            .populate('subject', 'name') // Подгрузить только поле name из коллекции Subjects
            .populate('schoolClass', 'name'); // Подгрузить только поле name из коллекции Classes

        res.status(200).json(getSuccessResponse({ reports }));
    } catch (err) {
        console.error(err);
        res.status(500).json(getErrorResponse('Сталася помилка при отриманні звіту'));
    }
});


module.exports = router;