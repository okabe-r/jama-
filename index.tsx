import React from 'react';
import { createRoot } from 'react-dom/client';

const { useState, useMemo, useEffect, useRef } = React;

const toArabicNumerals = (num) => {
    const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return String(num).split('').map(digit => arabicNumerals[parseInt(digit, 10)]).join('');
};

const normalizeArabic = (text) => {
  if (!text) return '';
  return text
    .replace(/[\u064B-\u0652]/g, "") // Remove harakat
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
};

const diffWords = (oldStr, newStr) => {
    const cleanOldStr = oldStr.replace(/<br\s*\/?>/gi, " ");
    const cleanNewStr = newStr.replace(/<br\s*\/?>/gi, " ");

    const punctuationRegex = /[.,()\[\]\/#!$؟%\^&\*;:{}=_`~،؛«»﴿﴾ﷺ●-]/g;
    const normalizeWordForDiff = (word) => normalizeArabic(word).replace(punctuationRegex, '');

    const oldWords = cleanOldStr.split(/\s+/).filter(Boolean);
    const newWords = cleanNewStr.split(/\s+/).filter(Boolean);

    const m = oldWords.length;
    const n = newWords.length;
    const dp = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (normalizeWordForDiff(oldWords[i - 1]) === normalizeWordForDiff(newWords[j - 1])) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    const wordDiffs = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && normalizeWordForDiff(oldWords[i - 1]) === normalizeWordForDiff(newWords[j - 1])) {
            wordDiffs.unshift({ value: oldWords[i - 1], type: 'correct' });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            wordDiffs.unshift({ value: newWords[j - 1], type: 'added' });
            j--;
        } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
            wordDiffs.unshift({ value: oldWords[i - 1], type: 'missing' });
            i--;
        } else {
            break;
        }
    }
    
    if (wordDiffs.length === 0) {
        const result = [];
        if (oldWords.length > 0) result.push({ value: oldWords.join(' '), type: 'missing'});
        if (newWords.length > 0) result.push({ value: newWords.join(' '), type: 'added'});
        return result;
    }

    const groupedResult = [];
    let currentPart = { ...wordDiffs[0] };

    for (let k = 1; k < wordDiffs.length; k++) {
        const nextPart = wordDiffs[k];
        if (nextPart.type === currentPart.type) {
            currentPart.value += ' ' + nextPart.value;
        } else {
            groupedResult.push(currentPart);
            currentPart = { ...nextPart };
        }
    }
    groupedResult.push(currentPart);

    return groupedResult;
};

const renderInteractiveDiff = (diff) => {
    if (!diff) return null;
    return diff.map((part, index) => {
        if (part.type === 'correct') {
            return React.createElement('span', { key: index, className: 'diff-correct' }, part.value + ' ');
        }
        if (part.type === 'added') {
            return React.createElement('span', { key: index, className: 'diff-added' }, part.value + ' ');
        }
        if (part.type === 'missing') {
             return React.createElement('span', {
                key: index,
                className: 'diff-missing-marker',
                'data-tooltip': part.value,
                title: part.value // Fallback for native tooltip
            }, '✽ ');
        }
        return null;
    });
};


const RecitationTestFlow = ({ allHadiths, processedHadiths, onClose }) => {
    const [stage, setStage] = useState('inputStartId'); // 'inputStartId', 'testBab', 'testHadith'
    const [currentTestId, setCurrentTestId] = useState(null);
    const [idInput, setIdInput] = useState('');
    const [userInput, setUserInput] = useState('');
    const [comparison, setComparison] = useState(null);
    const modalRef = useRef(null);
    const [history, setHistory] = useState([]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';
        if (modalRef.current) modalRef.current.focus();
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'auto';
        };
    }, [onClose]);

    const currentHadith = useMemo(() => currentTestId ? allHadiths.find(h => h.id === currentTestId) : null, [currentTestId, allHadiths]);
    const processedCardData = useMemo(() => currentTestId ? processedHadiths.find(h => h.id === currentTestId) : null, [currentTestId, processedHadiths]);
    const isLastHadithInBab = useMemo(() => {
        if (!currentHadith) return false;
        const nextHadith = allHadiths.find(h => h.id === currentHadith.id + 1);
        return !nextHadith || nextHadith.bab !== currentHadith.bab;
    }, [currentHadith, allHadiths]);

    const handleStartTest = () => {
        const id = parseInt(idInput, 10);
        if (isNaN(id) || !allHadiths.some(h => h.id === id)) {
            alert('الرجاء إدخال رقم حديث صحيح.');
            return;
        }
        setCurrentTestId(id);
        setStage('testBab');
    };

    const handleCorrection = () => {
        const correctText = stage === 'testBab' ? currentHadith.bab : currentHadith.text;
        const diffResult = diffWords(correctText, userInput);
        setComparison(diffResult);
    };

    const handleTryAgain = () => {
        setComparison(null);
        setUserInput('');
    };

    const handleNext = () => {
        setHistory(prev => [...prev, { stage, currentTestId }]);
        setComparison(null);
        setUserInput('');
        if (stage === 'testBab') {
            setStage('testHadith');
        } else if (stage === 'testHadith') {
            if (isLastHadithInBab) {
                const nextId = currentTestId + 1;
                if (allHadiths.some(h => h.id === nextId)) {
                    setCurrentTestId(nextId);
                    setStage('testBab');
                } else {
                    alert('أحسنت، لقد أكملت الاختبار!');
                    onClose();
                }
            } else {
                setCurrentTestId(currentTestId + 1);
            }
        }
    };
    
    const handleBack = () => {
        if (history.length > 0) {
            const lastState = history[history.length - 1];
            setStage(lastState.stage);
            setCurrentTestId(lastState.currentTestId);
            setHistory(prev => prev.slice(0, -1));
            setComparison(null);
            setUserInput('');
        }
    };

    const createMarkup = (htmlString) => ({ __html: htmlString });

    const renderContent = () => {
        if (stage === 'inputStartId') {
            return React.createElement(React.Fragment, null,
                React.createElement('h3', null, 'بدء اختبار الحفظ'),
                React.createElement('p', { className: 'bab-reference' }, 'ادخل رقم الحديث الذي تريد أن تبدأ منه'),
                React.createElement('input', {
                    type: 'number',
                    value: idInput,
                    onChange: e => setIdInput(e.target.value),
                    placeholder: 'رقم الحديث',
                    'aria-label': 'رقم الحديث للبدء'
                }),
                React.createElement('div', { className: 'modal-actions' },
                    React.createElement('button', { className: 'section-button', onClick: handleStartTest }, 'ابدأ الاختبار')
                )
            );
        }

        if (comparison) {
            const originalTextLabel = stage === 'testBab' ? 'اسم الباب الصحيح' : 'الحديث الصحيح';
            const nextButtonText = stage === 'testBab' ? 'الحديث التالي' : (isLastHadithInBab ? 'الباب التالي' : 'الحديث التالي');
            const originalText = stage === 'testBab' ? currentHadith.bab : currentHadith.text;

            return React.createElement('div', { className: 'comparison-view' },
                React.createElement('h4', null, 'إجابتك (مرر الفأرة فوق ✽ لرؤية الناقص)'),
                React.createElement('p', null, renderInteractiveDiff(comparison)),
                React.createElement('h4', null, originalTextLabel),
                React.createElement('p', { dangerouslySetInnerHTML: createMarkup(originalText) }),
                React.createElement('div', { className: 'modal-actions' },
                    React.createElement('button', { className: 'info-button', onClick: handleTryAgain }, 'حاول مرة أخرى'),
                    React.createElement('button', { className: 'section-button', onClick: handleNext }, nextButtonText)
                )
            );
        }

        if (stage === 'testBab') {
            return React.createElement(React.Fragment, null,
                React.createElement('h3', null, `اكتب اسم الباب للحديث رقم ${toArabicNumerals(currentTestId)}`),
                React.createElement('textarea', {
                    value: userInput,
                    onChange: e => setUserInput(e.target.value),
                    placeholder: 'اكتب اسم الباب هنا...',
                    'aria-label': 'صندوق إدخال اسم الباب'
                }),
                React.createElement('div', { className: 'modal-actions' },
                    history.length > 0 && React.createElement('button', { className: 'back-button', onClick: handleBack }, 'عودة'),
                    React.createElement('button', { className: 'section-button', onClick: handleCorrection }, 'تصحيح الإجابة')
                )
            );
        }

        if (stage === 'testHadith' && processedCardData) {
            return React.createElement(React.Fragment, null,
                React.createElement('h3', null, 'اكتب الحديث'),
                React.createElement('div', { className: 'test-card-front' },
                    React.createElement('span', { className: 'hadith-number' }, `حديث: ${toArabicNumerals(processedCardData.id)}`),
                    React.createElement('div', { className: 'bab-name-wrapper' },
                        React.createElement('span', { className: "bab-name" }, processedCardData.bab),
                        processedCardData.babCount > 1 && React.createElement('span', { className: 'bab-number-badge' }, toArabicNumerals(processedCardData.babIndex))
                    )
                ),
                React.createElement('textarea', {
                    value: userInput,
                    onChange: e => setUserInput(e.target.value),
                    placeholder: 'اكتب الحديث هنا...',
                    'aria-label': 'صندوق إدخال الحديث'
                }),
                React.createElement('div', { className: 'modal-actions' },
                    history.length > 0 && React.createElement('button', { className: 'back-button', onClick: handleBack }, 'عودة'),
                    React.createElement('button', { className: 'section-button', onClick: handleCorrection }, 'تصحيح الإجابة')
                )
            );
        }

        return null;
    };

    return React.createElement('div', { className: 'modal-overlay', onClick: onClose },
        React.createElement('div', { className: 'modal-content', onClick: e => e.stopPropagation(), ref: modalRef, tabIndex: -1, role: 'dialog', 'aria-modal': true },
            React.createElement('button', { className: 'modal-close-button', onClick: onClose, 'aria-label': 'إغلاق' }, '×'),
            renderContent()
        )
    );
};


const TranscriptionModal = ({ cardData, onClose }) => {
    const [userInput, setUserInput] = useState('');
    const [comparison, setComparison] = useState(null);
    const modalRef = useRef(null);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';
        
        if (modalRef.current) {
            modalRef.current.focus();
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'auto';
        };
    }, [onClose]);

    const handleCorrection = () => {
        const diffResult = diffWords(cardData.backText, userInput);
        setComparison(diffResult);
    };

    const handleTryAgain = () => {
        setComparison(null);
        setUserInput('');
    };

    const createMarkup = (htmlString) => ({ __html: htmlString });

    return React.createElement('div', { className: 'modal-overlay', onClick: onClose },
        React.createElement('div', { className: 'modal-content', onClick: e => e.stopPropagation(), ref: modalRef, tabIndex: -1, role: 'dialog', 'aria-modal': true },
            React.createElement('button', { className: 'modal-close-button', onClick: onClose, 'aria-label': 'إغلاق' }, '×'),
            React.createElement('h3', null, 'اكتب الحديث'),
            React.createElement('p', { className: 'bab-reference' }, cardData.bab),
            !comparison ? (
                React.createElement(React.Fragment, null,
                    React.createElement('textarea', {
                        value: userInput,
                        onChange: e => setUserInput(e.target.value),
                        placeholder: 'اكتب الحديث هنا...',
                        'aria-label': 'صندوق إدخال الحديث'
                    }),
                    React.createElement('div', { className: 'modal-actions' },
                        React.createElement('button', { className: 'section-button', onClick: handleCorrection }, 'تصحيح الإجابة')
                    )
                )
            ) : (
                React.createElement('div', { className: 'comparison-view' },
                    React.createElement('h4', null, 'إجابتك (مرر الفأرة فوق ✽ لرؤية الناقص)'),
                    React.createElement('p', null, renderInteractiveDiff(comparison)),
                    React.createElement('h4', null, 'الحديث الصحيح'),
                    React.createElement('p', { dangerouslySetInnerHTML: createMarkup(cardData.backText) }),
                    React.createElement('div', { className: 'modal-actions' },
                        React.createElement('button', { className: 'section-button', onClick: handleTryAgain }, 'حاول مرة أخرى')
                    )
                )
            )
        )
    );
};


const processHadithsData = (hadiths) => {
    const babCounts = hadiths.reduce((acc, h) => {
        acc[h.bab] = (acc[h.bab] || 0) + 1;
        return acc;
    }, {});
    const babIndices = {};

    return hadiths.map(hadith => {
        const count = babCounts[hadith.bab];
        const currentIndex = (babIndices[hadith.bab] || 0) + 1;
        babIndices[hadith.bab] = currentIndex;
        return { 
            id: hadith.id, 
            bab: hadith.bab, 
            babIndex: currentIndex, 
            babCount: count, 
            backText: hadith.text 
        };
    });
};

const HadithCard = ({ cardData }) => {
    const [isFlipped, setIsFlipped] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const toggleFlip = () => setIsFlipped(!isFlipped);
    const createMarkup = (htmlString) => ({ __html: htmlString });

    const openModal = (e) => {
        e.stopPropagation();
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };

    return React.createElement(React.Fragment, null,
        isModalOpen && React.createElement(TranscriptionModal, { cardData, onClose: closeModal }),
        React.createElement('div', { className: "card-container", onClick: toggleFlip, role: "button", tabIndex: 0 },
            React.createElement('div', { className: `card ${isFlipped ? 'is-flipped' : ''}` },
                React.createElement('div', { className: 'card-face card-front' },
                    React.createElement('span', { className: 'hadith-number' }, `حديث: ${toArabicNumerals(cardData.id)}`),
                    React.createElement('div', { className: 'bab-name-wrapper' },
                        React.createElement('span', { className: "bab-name" }, cardData.bab),
                        cardData.babCount > 1 && React.createElement('span', { className: 'bab-number-badge' }, toArabicNumerals(cardData.babIndex))
                    ),
                    React.createElement('button', { className: 'transcribe-button', onClick: openModal }, 'كتابة الحديث')
                ),
                React.createElement('div', { className: 'card-face card-back' },
                     React.createElement('p', { className: "hadith-text", dangerouslySetInnerHTML: createMarkup(cardData.backText) })
                )
            )
        )
    );
};

const App = () => {
    const [allHadiths, setAllHadiths] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [view, setView] = useState('book-selection');
    const [currentBookName, setCurrentBookName] = useState(null);
    const [currentBookIndex, setCurrentBookIndex] = useState(null);
    const [currentGroup, setCurrentGroup] = useState(null);
    const [currentGroupIndex, setCurrentGroupIndex] = useState(null);
    const [isTestMode, setIsTestMode] = useState(false);

    useEffect(() => {
        fetch('./hadiths.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                setAllHadiths(data);
            })
            .catch(e => {
                console.error("Failed to load hadiths.json", e);
                setError("فشل تحميل ملف الأحاديث. الرجاء التأكد من وجود ملف 'hadiths.json'.");
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, []);

    const uniqueBooks = useMemo(() => {
        if (!allHadiths || allHadiths.length === 0 || allHadiths.every(h => !h.book)) return [];
        return [...new Set(allHadiths.map(h => h.book))];
    }, [allHadiths]);

    const hadithGroups = useMemo(() => {
        if (!currentBookName || !allHadiths || allHadiths.length === 0) return [];
        const hadithsOfBook = allHadiths.filter(h => h.book === currentBookName);
        if (hadithsOfBook.length === 0) return [];

        const groups = [];
        const groupSize = 10;
        for (let i = 0; i < hadithsOfBook.length; i += groupSize) {
            const startHadith = hadithsOfBook[i];
            const endHadith = hadithsOfBook[Math.min(i + groupSize - 1, hadithsOfBook.length - 1)];
            groups.push({ start: startHadith.id, end: endHadith.id });
        }
        
        if (groups.length > 1) {
            const lastGroup = groups[groups.length - 1];
            if (lastGroup.end - lastGroup.start + 1 <= 1) { // Merge if last group is tiny
                const secondLastGroup = groups[groups.length - 2];
                secondLastGroup.end = lastGroup.end;
                groups.pop();
            }
        }
        return groups;
    }, [currentBookName, allHadiths]);

    const processedHadiths = useMemo(() => {
        if (!allHadiths || allHadiths.length === 0 || allHadiths.every(h => !h.book)) return [];
        return processHadithsData(allHadiths);
    }, [allHadiths]);

    const hadithsForCurrentGroup = useMemo(() => {
        if (!currentGroup || !processedHadiths.length) return [];
        return processedHadiths.filter(
            h => h.id >= currentGroup.start && h.id <= currentGroup.end
        );
    }, [currentGroup, processedHadiths]);
    
    if (isLoading) {
        return React.createElement('div', { id: "app-container" },
            React.createElement('header', null,
                React.createElement('h1', null, "الجمع بين الصحيحين")
            ),
            React.createElement('p', null, "جار تحميل البيانات...")
        );
    }
    
    if (error) {
         return React.createElement('div', { id: "app-container" },
            React.createElement('header', null,
                React.createElement('h1', null, "الجمع بين الصحيحين")
            ),
            React.createElement('p', { style: { color: 'red' } }, error)
        );
    }

    if (!allHadiths || allHadiths.length === 0 || allHadiths.every(h => !h.book)) {
        return React.createElement('div', { id: "app-container" },
            React.createElement('header', null,
                React.createElement('h1', null, "الجمع بين الصحيحين")
            ),
            React.createElement('p', null, "الرجاء ملء ملف 'hadiths.json' بالأحاديث لتشغيل التطبيق.")
        );
    }

    const handleBookClick = (bookName, index) => {
        setCurrentBookName(bookName);
        setCurrentBookIndex(index);
        setView('group-selection');
    };

    const handleGroupClick = (group, index) => {
        setCurrentGroup(group);
        setCurrentGroupIndex(index);
        setView('hadith-display');
        window.scrollTo(0, 0);
    };

    const handleBackToBooks = () => {
        setView('book-selection');
        setCurrentBookName(null);
        setCurrentBookIndex(null);
        setCurrentGroup(null);
        setCurrentGroupIndex(null);
    };
    
    const handleBackToGroups = () => {
        setView('group-selection');
        setCurrentGroup(null);
        setCurrentGroupIndex(null);
    };

    const handleNextGroup = () => {
        if (currentGroupIndex < hadithGroups.length - 1) {
            const newIndex = currentGroupIndex + 1;
            setCurrentGroupIndex(newIndex);
            setCurrentGroup(hadithGroups[newIndex]);
            window.scrollTo(0, 0);
        }
    };
    
    const handlePreviousGroup = () => {
        if (currentGroupIndex > 0) {
            const newIndex = currentGroupIndex - 1;
            setCurrentGroupIndex(newIndex);
            setCurrentGroup(hadithGroups[newIndex]);
            window.scrollTo(0, 0);
        }
    };

    const handleNextBook = () => {
        if (currentBookIndex < uniqueBooks.length - 1) {
            const newIndex = currentBookIndex + 1;
            setCurrentBookIndex(newIndex);
            setCurrentBookName(uniqueBooks[newIndex]);
            setCurrentGroup(null);
            setCurrentGroupIndex(null);
            window.scrollTo(0, 0);
        }
    };

    const handlePreviousBook = () => {
        if (currentBookIndex > 0) {
            const newIndex = currentBookIndex - 1;
            setCurrentBookIndex(newIndex);
            setCurrentBookName(uniqueBooks[newIndex]);
            setCurrentGroup(null);
            setCurrentGroupIndex(null);
            window.scrollTo(0, 0);
        }
    };

    return React.createElement('div', { id: "app-container" },
        React.createElement('header', null,
            React.createElement('h1', null, "الجمع بين الصحيحين")
        ),
         isTestMode && React.createElement(RecitationTestFlow, {
            allHadiths: allHadiths,
            processedHadiths: processedHadiths,
            onClose: () => setIsTestMode(false)
        }),
        React.createElement('main', { id: "content-area" },
            view === 'book-selection' && React.createElement('div', { className: "view active-view" },
                React.createElement('div', { style: { marginBottom: '30px' } },
                    React.createElement('button', { 
                        className: "section-button info-button", 
                        style: { flex: 'none', minWidth: '300px' },
                        onClick: () => setIsTestMode(true) 
                    }, "اختبار الحفظ")
                ),
                React.createElement('h2', null, "اختر كتابًا"),
                React.createElement('div', { id: "section-buttons-container" },
                    uniqueBooks.map((book, index) =>
                        React.createElement('button', { key: book, className: "section-button", onClick: () => handleBookClick(book, index) }, book)
                    )
                )
            ),
            view === 'group-selection' && React.createElement('div', { className: "view active-view" },
                React.createElement('h2', null, currentBookName),
                 React.createElement('div', { className: "navigation-controls" },
                    React.createElement('button', { className: "back-button", onClick: handleBackToBooks }, "← العودة للكتب"),
                    React.createElement('button', {
                        className: "info-button",
                        onClick: handlePreviousBook,
                        disabled: currentBookIndex === 0
                    }, "الكتاب السابق"),
                    React.createElement('button', {
                        className: "info-button",
                        onClick: handleNextBook,
                        disabled: currentBookIndex >= uniqueBooks.length - 1
                    }, "الكتاب التالي")
                ),
                React.createElement('div', { id: "section-buttons-container" },
                    hadithGroups.map((group, index) =>
                        React.createElement('button', { 
                            key: `${group.start}-${group.end}`, 
                            className: "section-button", 
                            onClick: () => handleGroupClick(group, index) 
                        }, `الأحاديث ${toArabicNumerals(group.start)} - ${toArabicNumerals(group.end)}`)
                    )
                )
            ),
            view === 'hadith-display' && React.createElement('div', { className: "view active-view" },
                React.createElement('h2', null, `${currentBookName} (الأحاديث ${toArabicNumerals(currentGroup.start)} - ${toArabicNumerals(currentGroup.end)})`),
                React.createElement('div', { className: "navigation-controls" },
                    React.createElement('button', { className: "back-button", onClick: handleBackToGroups }, "← العودة للمجموعات"),
                    React.createElement('button', { 
                        className: "info-button", 
                        onClick: handlePreviousGroup,
                        disabled: currentGroupIndex === 0
                    }, "المجموعة السابقة"),
                    React.createElement('button', { 
                        className: "info-button", 
                        onClick: handleNextGroup,
                        disabled: currentGroupIndex >= hadithGroups.length - 1
                    }, "المجموعة التالية")
                ),
                React.createElement('div', { id: "hadith-cards-container" },
                    hadithsForCurrentGroup.map(card =>
                        React.createElement(HadithCard, { key: card.id, cardData: card })
                    )
                )
            )
        ),
        React.createElement('footer', null, React.createElement('p', null, "© 2024"))
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(React.createElement(App));
}
