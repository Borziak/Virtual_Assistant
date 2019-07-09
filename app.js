// eslint-disable-next-line no-undef
jQuery(document).ready(function ($) {
    const baseUrl = 'https://kh-gis-chat-bot.intetics.com';

    $('#widget_button').draggable({
        containment: 'window',
        cursor: "grabbing",
        start: function () {
            $('#widget_button').off('click');
        },
        stop: function () {
            setTimeout(function () {
                $('#widget_button').on('click', chat.open);
            }, 100);
        }
    });
    $('#widget_container').draggable({
        handle: '#widget_header',
        containment: 'window',
        cursor: "grabbing"
    });

    class MessageWrapper {
        constructor(text, card, event, choice, carousel) {
            this.text = text;
            this.card = card;
            this.event = event;
            this.choice = choice;
            this.carousel = carousel;
        }
    }

    class Text {
        constructor(text) {
            this.text = text;
        }
    };

    class Event {
        constructor(name, languageCode, parameters, display) {
            this.name = name;
            this.languageCode = languageCode;
            this.parameters = parameters;
            this.display = display;
        }
    }

    /* class Choice {
        constructor (buttons) {
            this.buttons = buttons;
        }
    }

    class Button {
        constructor(text, postback) {
            this.text = text;
            this.postback = postback;
        }
    } */

    class MessageContent {
        constructor(messages, currentUri) {
            this.messages = messages;
            this.currentUri = currentUri;
        }
    };

    class MessageDto {
        constructor(message, senderType, userDto) {
            this.message = message; // MessageContent
            this.userDto = userDto;
            this.senderType = senderType;
        }
    }

    class ModelFactory {
        static getUserObject(id) {
            return {
                id: id
            };
        };

        static messageDtoBuilderText(content, senderType) {
            const _content = [new MessageWrapper()];
            _content[0].text = new Text();
            _content[0].text.text = [content];
            const messageContent = new MessageContent(_content, chat.getCurrentLocation());
            const response = new MessageDto(messageContent, senderType, chat.user);
            console.log(`BUILD TEXT: ${JSON.stringify(response)}`);
            return response;
        }

        static messageDtoBuilderEvent(content, senderType, display) {
            const _content = [new MessageWrapper()];
            _content[0].event = new Event();
            _content[0].event.name = content;
            _content[0].event.display = display || undefined;
            const messageContent = new MessageContent(_content, chat.getCurrentLocation());
            const response = new MessageDto(messageContent, senderType, chat.user);
            console.log(`BUILD EVENT: ${JSON.stringify(response)}`);
            return response;
        }
    }

    // Model part end

    const SenderType = Object.freeze({
        USER: 'user',
        BOT: 'bot'
    });

    const WS_ENDPOINTS = {
        INIT_USER: 'init-user',
        INIT_USER_COVERTLY: 'init-user-covertly',
        INIT_BOT: 'init-bot',
        INIT_HISTORY: 'init-history',
        CLEAR_HISTORY: 'clear-history',
        CLEAR_HISTORY_CONFIRMATION: 'clear-history-confirmation',
        MESSAGE: 'message',
        CONNECT: 'connect',
        DISCONNECT: 'disconnect',
        EXCEPTION: 'exception'
    };

    const lStorage = {
        get: function (key) {
            return JSON.parse(localStorage.getItem(key));
        },
        keys: {
            USER: 'user',
            BOT: 'bot',
            HISTORY: 'history',
            IS_WIDGET_OPEN: 'isWidgetOpen',
            PREVIOUS_URL: 'previousUrl'
        },
        set: function (key, item) {
            localStorage.setItem(key, JSON.stringify(item));
        },
        remove: function (key) {
            localStorage.removeItem(key);
        },
        clear: function () {
            localStorage.clear();
        },
        has: function (key) {
            return localStorage.getItem(key) !== null;
        },
        addMessageToHistory: function (message) {
            let history = this.get(this.keys.HISTORY);
            history = history == null ? [] : history;
            history.push(message);
            this.set(this.keys.HISTORY, history);
            // console.log(history);
            return history;
        }

    };
    const chat = {
        nextMessageTimer: null,
        socket: {},
        opened: false,
        active: false,
        guestName: 'dear Guest',
        firstTime: true,
        APIkey: '563492ad6f91700001000001bb151c8c07f048768f0c409fc846429b',
        messageQueue: 0,
        messageArray: [],
        lastMessage: '',
        type_timer: 1000,
        pause_timer: 500,
        access_token: '',
        authPath: '',
        pausedMessage: null,
        currentLocation: location.href,
        expires: 10,
        connect: function () {
            let openWindow = chat.getCookie('opened');
            // console.log(openWindow);
            if (!openWindow) {
                console.log('Cookie has expired');
            }
            console.log('Connected');
            $('.connection_indicator').css('color', 'green');
            $('#widget_input_field').attr('placeholder', 'Enter your message...');
            $('#widget_input_field').attr('contenteditable', 'true');
            chat.initialize();
        },
        initBot: function (bot) {
            chat.bot = bot;
            lStorage.set(lStorage.keys.BOT, bot);
            console.log(`Bot has been initialized`);
            console.log(bot);
        },
        initUser: function (user) {
            chat.user = user;
            lStorage.set(lStorage.keys.USER, user);
            console.log(`get init-user response with: ${user}`);
            console.log(`starting to init history`);
            chat.socket.emit(WS_ENDPOINTS.INIT_HISTORY, user);
            // socket.emit(WS_ENDPOINTS.MESSAGE, ModelFactory.messageDtoBuilderEvent('WELCOME', SenderType.USER));
        },
        initUserCovertly: function (user) {
            chat.user = user;
            lStorage.set(lStorage.keys.USER, user);
            console.log(`get init-user response with: ${user}`);
        },
        chatMessage: function (messageDto) {
            console.log(messageDto);
            const delayArr = messageDto.message.messages.filter(mw => mw.hasOwnProperty('payload') && mw.payload.hasOwnProperty('type') && mw.payload.type === 'delay');
            if (delayArr.length > 0) {
                const delay = delayArr[0].payload.delayValue;
                const eventName = delayArr[0].payload.eventName;
                chat.sendNextMessageEvent(delay, eventName);
            }
            chat.messageArray.push(messageDto);
            chat.flushNewQueue(chat.messageArray);
            // chat.addMessage(messageDto);
        },
        initHistory: function (history) {
            lStorage.set(lStorage.keys.HISTORY, history);
            console.log('init history process with data:');
            console.log(history);
            if (history) {
                chat.flushQueue(history);

                // history.forEach(m => );
                chat.socket.emit(WS_ENDPOINTS.MESSAGE, ModelFactory.messageDtoBuilderEvent('WELCOME', SenderType.USER));
            } else {
                console.log('init history null');
            }
        },
        openUrl(url) {
            window.open(url);
        },
        signInWithLinkedIn() {
            console.log('There is now implementation of this functionality');
        },
        chatException: function (data) {
            console.log('exception: ', data);
        },
        chatDisconnect: function () {
            console.log('Disconnected');
            $('.connection_indicator').css('color', 'red');
            $('#widget_input_field').attr('placeholder', 'Sorry, assitant can not be reached right now');
            $('#widget_input_field').attr('contenteditable', 'false');
        },
        open: function () {
            const self = this;
            $('#widget_button').off('click');
            self.opened = true;
            const button = $('#widget_button');
            const body = $('#widget_container');
            body.css({
                top: button.offset().top - body.outerHeight() - 40 + 'px',
                left: button.offset().left - body.outerWidth() + 100 + 'px'
            });
            button.addClass('clicked');
            body.addClass('opened');
            body.show('blind', {direction: 'down'}, 1000);
            if (body.offset().top <= 5) {
                $(body).animate({top: '10px'}, 500);
            }
            if (body.offset().left <= 5) {
                $(body).animate({left: '10px'}, 500);
            }
            button.draggable('disable');
            $('#widget_input').empty();
            // TODO update the line below when refactoring the init method
            lStorage.set(lStorage.keys.IS_WIDGET_OPEN, self.opened);
            $('#preview_container').empty().hide('drop', 600);
            // self.scrollQuery(10);
            let timer = setInterval(() => {
                $('#widget_queue')[0].scrollTop = 99999;
            }, 20);
            setTimeout(() => {
                clearInterval(timer);
            }, 1000);
            setTimeout(() => {
                if ($(window).outerWidth() <= 780) {
                    $('#widget_container').css('height', '95%');
                    let widgetHeight = $('#widget_container').outerHeight();
                    console.log(widgetHeight);
                    $('#widget_container').css('height', widgetHeight + 'px');
                    $('#widget_button').on('click', chat.open);
                }
            }, 2000);
            $('#widget_button').on('click', chat.open);
        },
        close: function () {
            const self = this;
            self.opened = false;
            const body = $('#widget_container');
            const button = $('#widget_button');
            button.css({
                top: body.offset().top + body.outerHeight() + 40 + 'px',
                left: body.offset().left + body.outerWidth() - button.outerWidth()
            });
            button.removeClass('clicked');
            body.removeClass('opened');
            body.hide('blind', {direction: 'down'}, 1000);
            // TODO update the line below when refactoring the init method
            lStorage.set(lStorage.keys.IS_WIDGET_OPEN, self.opened);
            button.draggable('enable');
            if (button.offset().top + button.outerHeight() >= $(window).outerHeight() - 5) {
                $(button).animate({top: $(window).outerHeight() - button.outerHeight() - 10 + 'px'}, 500);
            }

            if (button.offset().left <= 5) {
                $(body).animate({left: '10px'}, 500);
            }

            if (button.offset().left + button.outerWidth() >= $(window).outerWidth - 5) {
                $(body).animate({left: $(window).outerWidth - button.outerWidth() + 10 + 'px'}, 500);
            }
        },
        reposition: function () {
            const body = $('#widget_container');
            const windowHeight = $(window).outerHeight();
            const windowWidth = $(window).outerWidth();
            if (body.offset().top <= 5) {
                $(body).animate({top: '10px'}, 500);
            } else if (body.offset().top + body.outerHeight() > windowHeight) {
                $(body).animate({top: windowHeight - body.outerHeight() - 5 + 'px'}, 500);
            }
            if (body.offset().left < 0) {
                $(body).animate({left: '10px'}, 500);
            } else if (body.offset().left + body.outerWidth() > windowWidth) {
                $(body).animate({left: windowWidth - body.outerWidth() - 5 + 'px'}, 500);
            }
        },
        setCookie: function (name, value, options) {
            options = options || {};

            var expires = options.expires;

            if (typeof expires === 'number' && expires) {
                var d = new Date();
                d.setTime(d.getTime() + expires * 1000);
                expires = options.expires = d;
            }
            if (expires && expires.toUTCString) {
                options.expires = expires.toUTCString();
            }

            value = encodeURIComponent(value);

            var updatedCookie = name + '=' + value;

            for (var propName in options) {
                updatedCookie += '; ' + propName;
                var propValue = options[propName];
                if (propValue !== true) {
                    updatedCookie += '=' + propValue;
                }
            }
            document.cookie = updatedCookie;
        },
        getCookie: function (name) {
            var matches = document.cookie.match(new RegExp(
                // eslint-disable-next-line no-useless-escape
                '(?:^|; )' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'
            ));
            return matches ? decodeURIComponent(matches[1]) : undefined;
        },
        deleteCookie: function (name) {
            const self = this;
            self.setCookie(name, '', {
                expires: -1
            });
        },

        addMessage: function (messageDto) {
            const sender = messageDto.senderType;
            const self = this;
            setTimeout(function () {
                const options = {direction: ''};
                if (sender === 'bot') {
                    options.direction = 'left';
                } else {
                    options.direction = 'right';
                }
                messageDto.message.messages.forEach(mw => {
                    self.messageQueue++;
                    if (mw.text) {
                        mw.text.text.forEach(t => {
                            self.lastMessage = t;
                            self.showText(t, sender, options);
                        });
                    }
                    if (mw.event) {
                        self.lastMessage = mw.event.name;
                        if (mw.event.display) {
                            self.showEvent(mw.event, sender, options);
                        }
                    }
                    if (mw.choice) {
                        $('.choice_container').remove();
                        self.showChoice(mw.choice);
                        mw.choice = null;
                    }
                    if (mw.card) {
                        self.showCard(mw.card, messageDto);
                        mw.card.buttons = null;
                    }
                    if (mw.carousel) {
                        console.log(mw.carousel.cards);
                        self.showCarousel(mw.carousel.cards, messageDto);
                    }
                    if (mw.linksNecklace) {
                        self.showNecklace(mw.linksNecklace.links);
                    }
                });
                self.scrollQuery(1);
                lStorage.addMessageToHistory(messageDto);
            }, 600);
        },
        showEvent: function (event, sender, options) {
            const self = this;
            self.showText(event.display, sender, options);
        },
        showText: function (text, sender, options) {
            const self = this;
            const newMessage = document.createElement('div');
            $(newMessage).addClass('widget_message ' + sender + '_message');
            $(newMessage).append(text);
            $(newMessage).appendTo('#widget_queue').show('drop', options, 600);
            if (!self.opened) {
                self.showPreview(text);
            }
        },
        onRespond: function (messageDto) {
            chat.cancelNextMessageEvent();
            chat.socket.emit(WS_ENDPOINTS.MESSAGE, messageDto);
            chat.addMessage(messageDto);
        },
        showChoice: function (choice) {
            const self = this;
            if (choice.buttons) {
                const choiceContainer = document.createElement('div');
                $(choiceContainer).addClass('choice_container');
                choice.buttons.forEach(function (button) {
                    const choiceButton = document.createElement('span');
                    $(choiceButton).addClass('choice_button');
                    $(choiceButton).text(button.text);
                    // Здесь обработчик на нажатие кнопки
                    choiceButton.addEventListener('click', function () {
                        console.log($(this).text());
                        $(this).addClass('chosen');
                        // let buttonPostback = /(CALL)\+(\w*)\+(.*)|(CALL)\+(\w*)/g.exec(button.postback);
                        if (button.postback.startsWith('CALL+')) {
                            const [, functionName, parameter] = button.postback.split('+');
                            chat[functionName](parameter);
                        } else {
                            const chosenValue = ModelFactory.messageDtoBuilderText(button.postback, SenderType.USER);
                            self.onRespond(chosenValue);
                        }
                        $(choiceContainer).remove();
                    });
                    $(choiceContainer).append(choiceButton);
                });
                $(choiceContainer).appendTo('#widget_queue').show('drop', {direction: 'left'}, 600);
                // self.scrollQuery(600);
            }
        },
        scrollQuery: function (timeout) {
            $('#widget_queue').animate({scrollTop: $('#widget_queue')[0].scrollHeight}, timeout);
        },
        showPreview: function (text) {
            const options = {direction: 'left'};
            $('#preview_container').hide('drop', options, 600);
            setTimeout(function () {
                $('#preview_container').empty().append(text).show('fold', options, 600);
            }, 600);
        },
        isSessionExpired: function () {
            // TODO put over here implementation that return real status of session expiration
            return !lStorage.has(lStorage.keys.HISTORY);
        },
        isUserReactedExplicitly: function (lastUserMessage) {
            // const msg = lastUserMessage.message.messages[0];
            // return msg.hasOwnProperty('text') || (msg.hasOwnProperty('event') && msg.event.hasOwnProperty('display'));
            return false;
        },
        onUrlChanged: function () {
            console.log('new url detected');
            lStorage.set('previousUrl', chat.getCurrentLocation());
            const userHistory = lStorage.get(lStorage.keys.HISTORY).filter(m => m.senderType === 'user');
            if (!chat.isUserReactedExplicitly(userHistory[userHistory.length - 1])) {
                const messageDto = ModelFactory.messageDtoBuilderEvent('URL-CHANGED-EVENT', SenderType.USER);
                chat.onRespond(messageDto);
            }
            console.log($('#widget_queue').length);
        },
        initialize: function () {
            if (chat.isSessionExpired()) {
                chat.socket.emit(WS_ENDPOINTS.INIT_BOT, {id: 1});
                if (lStorage.has(lStorage.keys.USER)) {
                    // return history for existing user
                    const user = lStorage.get(lStorage.keys.USER);
                    chat.user = user;
                    chat.socket.emit(WS_ENDPOINTS.INIT_USER, ModelFactory.getUserObject(user.id));
                } else {
                    chat.socket.emit(WS_ENDPOINTS.INIT_USER, ModelFactory.getUserObject(null));
                }
            } else {
                chat.bot = lStorage.get(lStorage.keys.BOT);
                chat.user = lStorage.get(lStorage.keys.USER);
                const history = lStorage.get(lStorage.keys.HISTORY);
                chat.messageArray.push(history);
                chat.flushQueue(history);
                setTimeout(() => {
                    if (lStorage.has(lStorage.keys.IS_WIDGET_OPEN)) {
                        if (JSON.parse(lStorage.get(lStorage.keys.IS_WIDGET_OPEN))) {
                            // $('#widget_queue')[0].scrollTop = 648;
                            chat.open();
                        }
                    }
                }, 1000);
                // history.forEach(m => chat.addMessage(m));
                if (lStorage.has(lStorage.keys.IS_WIDGET_OPEN) && (chat.getCurrentLocation() !== lStorage.get(lStorage.keys.PREVIOUS_URL))) {
                    chat.onUrlChanged();
                }
            }
            setInterval(() => {
                chat.setCookie('opened', 'true');
            }, 1000);
        },
        deleteMyDataRequest: function () {
            const messageDto = ModelFactory.messageDtoBuilderEvent('CLEAR_USER_DATA', SenderType.USER, 'clear my data');
            chat.onRespond(messageDto);
            chat.cancelNextMessageEvent();
        },
        clearHistoryConfirmed: function (data) {
            console.log('Clear History confirmed  => ', data);
            delete chat.user;
            lStorage.clear();
            setTimeout(() => {
                $('#widget_queue').empty();
            }, 300);
        },
        sendNextMessageEvent: function (delay, eventName) {
            chat.nextMessageTimer = setTimeout(function () {
                const messageDto = ModelFactory.messageDtoBuilderEvent(eventName, SenderType.USER);
                chat.onRespond(messageDto);
            }, delay);
        },
        cancelNextMessageEvent: function () {
            if (chat.nextMessageTimer) {
                clearTimeout(chat.nextMessageTimer);
            }
            chat.nextMessageTimer = 0;
        },
        idleAction: function (timeout) {
            console.log('Idle for ' + timeout + ' seconds');
            chat.idleTimer = setTimeout(function () {
                chat.idleAction(timeout);
            }, timeout);
        },
        getCurrentLocation: function () {
            this.currentLocation = location.href;
            return this.currentLocation;
        },
        showCard: function (card, message) {
            const self = this;
            const newMessage = document.createElement('div');
            $(newMessage).addClass('widget_message bot_message carousel_card shadow_card');
            let cardButtons = {buttons: card.buttons};
            let content = null;
            let icon = document.createElement('i');
            $(icon).addClass('far fa-play-circle');
            if (card.imageUri) {
                content = new Image();
                content.src = card.imageUri;
                $(content).addClass('message_image');
            } else if (card.videoUri) {
                content = document.createElement('video');
                content.src = card.videoUri;
                $(content).addClass('message_video');
                $(newMessage).append(icon);
            }
            $(newMessage).append(content);
            icon.addEventListener('click', function () {
                chat.cancelNextMessageEvent();
                $('#modal_overlay').show('fade', 800, () => {
                    $('#modal_overlay').css('display', 'flex');
                    const lightbox = $('#widget_lightbox');
                    $(lightbox).empty();
                    $(content).clone().appendTo(lightbox);
                    if (card.title) {
                        $(lightbox).append('<div class="lightbox_descr">' + card.title + '</div>');
                    }
                    if (content.tagName.toLowerCase() === 'video') {
                        $(lightbox).find('video').attr('controls', 'true');
                        $(lightbox).find('video').attr('id', 'carousel_video');
                    }
                    $(lightbox).show('blind', {direction: 'up'}, 700);
                    $(document).mouseup(function (e) {
                        let container = $('#widget_lightbox');
                        if (container.has(e.target).length === 0) {
                            $('#widget_lightbox').hide('fade', 600);
                            $('#modal_overlay').hide('fade', 800);
                            document.getElementById('carousel_video').pause();
                            content.pause();
                        }
                    });
                    setTimeout(() => {
                        $('#close_lightbox').css('top', $('#widget_lightbox').offset().top - 40 + 'px');
                    }, 1500);
                });
            });
            content.addEventListener('click', function () {
                $('#modal_overlay').show('fade', 800, () => {
                    $('#modal_overlay').css('display', 'flex');
                    const lightbox = $('#widget_lightbox');
                    $(lightbox).empty();
                    $(this).clone().appendTo(lightbox);
                    if (card.title) {
                        $(lightbox).append('<div class="lightbox_descr">' + card.title + '</div>');
                    }
                    if (content.tagName.toLowerCase() === 'video') {
                        $(lightbox).find('video').attr('controls', 'true');
                        $(lightbox).find('video').attr('id', 'carousel_video');
                    }
                    chat.cancelNextMessageEvent();
                    $(lightbox).show('blind', {direction: 'up'}, 700);
                    $(document).mouseup(function (e) {
                        let container = $('#widget_lightbox');
                        if (container.has(e.target).length === 0) {
                            $('#widget_lightbox').hide('fade', 600);
                            $('#modal_overlay').hide('fade', 800);
                            $('#widget_lightbox').find('video')[0].pause();
                            document.getElementById('carousel_video').pause();
                            content.pause();
                            const delayArr = message.message.messages.filter(mw => mw.hasOwnProperty('payload') && mw.payload.hasOwnProperty('type') && mw.payload.type === 'delay');
                            console.log(message);
                            if (delayArr.length > 0) {
                                const delay = delayArr[0].payload.delayValue;
                                const eventName = delayArr[0].payload.eventName;
                                chat.sendNextMessageEvent(delay, eventName);
                            }
                        }
                    });
                    setTimeout(() => {
                        $('#close_lightbox').css('top', $('#widget_lightbox').offset().top - 40 + 'px');
                    }, 1500);
                });
            });
            $(newMessage).appendTo('#widget_queue').show('drop', {direction: 'left'}, 600);
            self.showChoice(cardButtons);
        },
        showCarousel: function (cards, message) {
            const carouselHolder = document.createElement('div');
            const carouselWrap = document.createElement('div');
            $(carouselWrap).addClass('carousel_wrap');
            $(carouselHolder).addClass('carousel_holder');
            const dotsHolder = document.createElement('div');
            $(dotsHolder).addClass('dots_holder').appendTo($(carouselWrap));
            cards.forEach((card, index) => {
                const newMessage = document.createElement('div');
                $(newMessage).addClass('widget_message bot_message carousel_card');
                let content = null;
                let icon = document.createElement('i');
                $(icon).addClass('far fa-play-circle');
                card.imageUri ? (content = new Image(), content.src = card.imageUri, $(content).addClass('message_image'))
                    : card.videoUri ? (content = document.createElement('video'), content.src = card.videoUri, $(newMessage).append(icon), $(content).addClass('message_video')) : null;

                $(newMessage).append(content);
                $(carouselHolder).append(newMessage);
                let dot = document.createElement('div');
                $(dot).addClass('control_dot').appendTo($(dotsHolder));
                index === 0 ? $(dot).addClass('active_dot') : null;

                content.addEventListener('click', function () {
                    chat.pausedMessage = message;
                    chat.cancelNextMessageEvent();
                    chat.showCarouselLightbox(cards, index);
                });

                icon.addEventListener('click', function () {
                    chat.cancelNextMessageEvent();
                    chat.showCarouselLightbox(cards, index);
                });

            });

            $(carouselWrap).append(carouselHolder);
            $(carouselWrap).appendTo('#widget_queue').show('drop', {direction: 'left'}, 600);
            $(carouselWrap).append('<div class="pane left_pane"><div class="arrow_button left_arrow"><i class="fas fa-chevron-left"></i></div></div>');
            $(carouselWrap).append('<div class="pane right_pane"><div class="arrow_button right_arrow"><i class="fas fa-chevron-right"></i></div></div>');

            let width = $(carouselHolder).outerWidth();
            $(carouselHolder).find('.carousel_card').css({'min-width': width || 267.91 + 'px'});

            $(carouselWrap).find('.arrow_button').on('click', function () {
                chat.scrollHolder(this, carouselHolder, cards.length, 9);
            });

            $('.control_dot').on('click', function () {
                chat.dotScroller(this, carouselHolder, cards.length, 8)
            });

            chat.checkArrows($(carouselWrap), $(carouselHolder).scrollLeft(), cards.length);
        },
        showCarouselLightbox: function (cards, scrollTo) {
            scrollTo = scrollTo || 0;
            let wrap = $('#carousel_wrap');
            let lightbox = $('#carousel_lightbox');
            lightbox.empty();
            wrap.find('.dots_holder').empty();
            cards.forEach((card, index) => {
                let content = null;
                card.imageUri ? (content = new Image(), content.src = card.imageUri) : card.videoUri ? (content = document.createElement('video'), content.src = card.videoUri) : null;
                const lightboxCard = document.createElement('div');
                $(lightboxCard).addClass('lightbox_card');
                $(lightboxCard).append(content);
                if (card.title) {
                    $(lightboxCard).append('<div class="lightbox_descr">' + card.title + '</div>');
                }
                if (content.tagName.toLowerCase() === 'video') {
                    $(content).attr('controls', 'true');
                    $(content).attr('id', 'carousel_video');
                    $(lightboxCard).append('<i class="fas fa-play"></i>');
                    $(content).on("pause", function () {
                        $(lightboxCard).find('i').css('display', 'block');
                        setTimeout(() => {
                            $(lightboxCard).find('i').removeClass('clicked_icon');
                        }, 600);
                    });
                    $(content).on("play", function () {
                        $(lightboxCard).find('i').addClass('clicked_icon');
                        setTimeout(() => {
                            $(lightboxCard).find('i').css('display', 'none');
                        }, 600);
                        content.play();
                    });
                }
                $(lightboxCard).find('i').on('click', function () {
                    $(this).addClass('clicked_icon');
                    setTimeout(() => {
                        $(this).css('display', 'none');
                    }, 600);
                    content.play();
                });
                lightbox.append(lightboxCard);
                let bigDot = document.createElement('div');
                $(bigDot).addClass('control_dot').appendTo(wrap.find('.dots_holder'));
            });
            $('#carousel_overlay').show('fade', 800, () => {
                $('.loader_circle').css('display', 'block');
                wrap.find('.left_pane').append('<div class="arrow_button left_arrow"><i class="fas fa-chevron-left"></i></div>');
                wrap.find('.right_pane').append('<div class="arrow_button right_arrow"><i class="fas fa-chevron-right"></i></div>');
                setTimeout(function () {
                    wrap.css('display', 'flex');
                    $('.loader_circle').css('display', 'none');
                    $('#carousel_overlay').css('display', 'flex');
                    $('#carousel_lightbox').animate({opacity: 1}, 400);
                    $(document).mouseup(function (e) {
                        if (wrap.has(e.target).length === 0 && $('#carousel_overlay').css('display') !== 'none') {
                            wrap.css('display', 'none');
                            $('#close_carousel_lightbox').css('display', 'none');
                            lightbox.css('opacity', 0);
                            $('#carousel_overlay').hide('fade', 800);
                            document.getElementById('carousel_video').pause();
                            wrap.find('.arrow_button').remove();
                            const delayArr = chat.pausedMessage.message.messages.filter(mw => mw.hasOwnProperty('payload') && mw.payload.hasOwnProperty('type') && mw.payload.type === 'delay');
                            if (delayArr.length > 0) {
                                const delay = delayArr[0].payload.delayValue;
                                const eventName = delayArr[0].payload.eventName;
                                chat.sendNextMessageEvent(delay, eventName);
                            }
                            // content.pause();
                        }
                    });
                    $('#close_carousel_lightbox').css({
                        top: $('#carousel_lightbox').offset().top - 50 + 'px',
                        display: 'block'
                    });
                    let currentDot = wrap.find('.control_dot')[scrollTo];
                    $(currentDot).addClass('active_dot');
                    let currentOffset = (lightbox.outerWidth() + 10) * scrollTo;
                    lightbox.animate({scrollLeft: currentOffset + 'px'}, 0);

                    wrap.find('.control_dot').on('click', function () {
                        chat.dotScroller(this, $('#carousel_lightbox')[0], cards.length, 10)
                    });

                    wrap.find('.arrow_button').on('click', function () {
                        chat.scrollHolder(this, $('#carousel_lightbox')[0], cards.length, 10);
                    });

                    chat.checkArrows(wrap, currentOffset, cards.length);
                }, cards.length * 50);
            });
        },
        scrollHolder: function (element, carousel, carouselLength, rightOffset) {
            console.log('Scrolled by arrow');
            $(element).off('click');
            let holder = $(carousel);
            let parent = holder.parent();
            let currentScroll = holder.scrollLeft();
            let scrollDistance = $(element).hasClass('right_arrow') ? currentScroll + holder.outerWidth() + rightOffset : currentScroll - holder.outerWidth() - rightOffset;
            holder.animate({scrollLeft: scrollDistance}, 600);
            let currentActive = parent.find('.active_dot');
            if ($(element).hasClass('right_arrow')) {
                if (currentActive.next('.control_dot')) {
                    currentActive.next('.control_dot').addClass('active_dot');
                    currentActive.removeClass('active_dot');
                } else {
                    currentActive.addClass('active_dot');
                }
            } else {
                if (currentActive.prev('.control_dot')) {
                    currentActive.prev('.control_dot').addClass('active_dot');
                    currentActive.removeClass('active_dot');
                } else {
                    currentActive.addClass('active_dot');
                }
            }
            chat.checkArrows($(parent), scrollDistance, carouselLength);
            setTimeout(function () {
                $(element).on('click', function () {
                    chat.scrollHolder(element, carousel, carouselLength, rightOffset);
                });
            }, 700);
        },
        dotScroller: function (dot, carousel, carouselLength, rightOffset) {
            console.log('Scrolled by dot');
            let holder = $(carousel);
            let parent = $(holder).parent();
            $(parent).find('.active_dot').removeClass('active_dot');
            $(dot).addClass('active_dot');
            let scrollDistance = holder.parent().find('.control_dot').index(dot) * (holder.outerWidth() + rightOffset);
            console.log(holder.parent().find('.control_dot').index(dot));
            holder.animate({scrollLeft: scrollDistance}, 600);
            chat.checkArrows($(parent), scrollDistance, carouselLength);
        },
        checkArrows: function (holder, scrollDistance, carouselLength) {
            if (scrollDistance <= 0) {
                holder.find('.left_pane').css('display', 'none');
                holder.find('.right_pane').css('display', 'flex');
            } else if (scrollDistance >= holder.outerWidth() * (carouselLength - 1)) {
                holder.find('.right_pane').css('display', 'none');
                holder.find('.left_pane').css('display', 'flex');
            } else if (0 < scrollDistance < holder.outerWidth() * (carouselLength - 1)) {
                holder.find('.right_pane').css('display', 'flex');
                holder.find('.left_pane').css('display', 'flex');
            }
        },
        showNecklace: function (links) {
            let necklaceWrap = document.createElement('div');
            $(necklaceWrap).addClass('necklace_wrap');
            let necklaceHolder = document.createElement('div');
            $(necklaceHolder).addClass('necklace_holder');
            links.forEach(function (link) {
                let linkContainer = document.createElement('div');
                $(linkContainer).addClass('necklase_link_wrap');
                $(linkContainer).append('<a target="_blank" href="' + link.linkUri + '"><img src="' + link.imageUri + '"></a>');
                $(linkContainer).hover(function () {
                    $(this).find('a').css('box-shadow', 'inset 10px 10px 50px 50px ' + link.hoverColor);
                }, function () {
                    $(this).find('a').css('box-shadow', 'inset 0px 0px 0px 0px ' + link.hoverColor);
                });
                $(necklaceHolder).append(linkContainer);
            });
            $(necklaceWrap).append(necklaceHolder);

            $(necklaceWrap).append('<div class="arrow_button left_arrow"><i class="fas fa-chevron-left"></i></div>');
            $(necklaceWrap).append('<div class="arrow_button right_arrow"><i class="fas fa-chevron-right"></i></div>');

            $(necklaceWrap).find('.arrow_button').on('click', function () {
                console.log('click');
                if ($(this).hasClass('right_arrow')) {
                    $(necklaceHolder).animate({scrollLeft: $(necklaceHolder).outerWidth()}, 600);
                } else {
                    $(necklaceHolder).animate({scrollLeft: 0}, 600);
                }

            });
            $(necklaceWrap).appendTo('#widget_queue');
        },
        flushQueue: function (currentQueue) {
            let self = this;
            if (currentQueue.length > 20) {
                currentQueue.splice(0, currentQueue.length - 20);
            }
            if (currentQueue.length > 0) {
                let currentElement = currentQueue.shift();
                self.addMessage(currentElement);
                self.flushQueue(currentQueue);
            }
        },
        flushNewQueue: function (currentQueue) {
            let self = this;
            if (currentQueue.length > 0) {
                let currentElement = currentQueue.shift();
                setTimeout(() => {
                    // self.scrollQuery(400);
                    $('#waves_message').show('drop', {'direction': 'left'}, 800);
                    setTimeout(() => {
                        $('#waves_message').hide('drop', {'direction': 'left'}, 200);
                        self.addMessage(currentElement);
                        self.flushQueue(currentQueue);
                    }, self.type_timer);
                }, self.pause_timer);
            }
        },
        linkedinGetAuthToken: function () {
            let init = {
                method: 'GET',
                headers: {
                    'Access-Control-Allow-Origin': '*'
                }
            };
            let myLinkedinRequest = new Request(baseUrl + '/node/api/rest/v1/auth/getToken', init);
            fetch(myLinkedinRequest).then((response) => {
                console.log(response);
                return response.json();
            }).then((textResponse) => {
                console.log(textResponse);
                location.href = textResponse.uri;
            });
        },
        linkedinExchangeAuthToken: function () {
            let locationResult = /\?code=([^\s]*)\&state=(\w*)/gi.exec(location.search);
            if (locationResult) {
                console.log('Code: ' + locationResult[1] + ' | state: ' + locationResult[2]);
                let init = {
                    method: 'GET'
                };
                let myLinkedinRequest = new Request(baseUrl + '/node/api/rest/v1/auth/exchangeToken/' + locationResult[1], init);
                fetch(myLinkedinRequest).then(function (result) {
                    return result.json();
                }).then(function (jsonResponse) {
                    console.log(jsonResponse);
                    chat.setCookie('access_token', jsonResponse.access_token, {expires: jsonResponse.expires});
                    chat.linkedinGetUser(jsonResponse.access_token);
                });
            } else {
                console.log('No Auth Token!');
            }
        },
        linkedinGetUser: function (token) {
            let newInit = {
                method: 'GET',
                headers: {
                    Connection: 'Keep-Alive',
                    Authorization: 'Bearer ' + token
                }
            };
            const user = lStorage.get(lStorage.keys.USER);
            let dataRequest = new Request(baseUrl + '/node/api/rest/v1/auth/getUser?token=' + token + '&userId=' + user.id, newInit);
            fetch(dataRequest).then(function (result) {
                return result.json();
            }).then(function (jsonResponse) {
                console.log(jsonResponse);
                chat.guestName = jsonResponse.localizedFirstName;
            });
        },
        connectWithHuman: function () {
            const msg = ModelFactory.messageDtoBuilderEvent('CONNECT_WITH_HUMAN', SenderType.USER, 'connect with human');
            chat.onRespond(msg);
            chat.cancelNextMessageEvent();
        },
        audioRecording: function () {
            if (!pressed) {
                $('#audio_input').addClass('recording');
                chat.cancelNextMessageEvent();
                console.log('Recognition started');
                recognition.start();
                pressed = true;
                $(this).addClass('recording');
            }
        }
    };

    chat.linkedinExchangeAuthToken();

    $('.human_connect').on('click', function () {
        chat.connectWithHuman();
    });

    $('#widget_input_field').keydown(function (e) {
        let result = /^\s+$/gi.exec($(this).text());
        if (e.keyCode === 13 && $(this).text() !== '' && !result) {
            e.preventDefault();
            const textContent = $(this).text();
            const messageDto = ModelFactory.messageDtoBuilderText(textContent, SenderType.USER);
            chat.onRespond(messageDto);
            $(this).empty();
        } else if (e.keyCode === 13 && ($(this).text() === '' || result)) {
            e.preventDefault();
        } else {
            if (!lStorage.has(lStorage.keys.USER)) {
                chat.socket.emit(WS_ENDPOINTS.INIT_USER_COVERTLY, {id: null});
            }
        }
    });

    $('#widget_button').on('click', function () {
        chat.open();
    });

    $('.close_widget').on('click', chat.close);

    $('.clear_history').on('click', chat.deleteMyDataRequest);

    let resizeTimer;
    $(window).resize(function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(chat.reposition, 500);
    });

    chat.socket = io(baseUrl, {path: '/chat/socket.io'});
    // chat.socket = io('http://localhost:3000', {path: '/chat/socket.io'});
    // if (chat.currentLocation.startsWith('https://kh-gis-chat-bot.intetics.com')) {
    //     // eslint-disable-next-line no-undef
    //     chat.socket = io('https://kh-gis-chat-bot.intetics.com', { path: '/chat/socket.io' });
    // } else {
    //     // eslint-disable-next-line no-undef
    //     chat.socket = io('http://localhost:3000', { path: '/chat/socket.io' });
    // }

    chat.socket.on(WS_ENDPOINTS.CONNECT, chat.connect);
    chat.socket.on(WS_ENDPOINTS.INIT_BOT, chat.initBot);
    chat.socket.on(WS_ENDPOINTS.INIT_USER, chat.initUser);
    chat.socket.on(WS_ENDPOINTS.INIT_USER_COVERTLY, chat.initUserCovertly);
    chat.socket.on(WS_ENDPOINTS.CLEAR_HISTORY_CONFIRMATION, chat.clearHistoryConfirmed);
    chat.socket.on(WS_ENDPOINTS.MESSAGE, chat.chatMessage);
    chat.socket.on(WS_ENDPOINTS.INIT_HISTORY, chat.initHistory);
    chat.socket.on(WS_ENDPOINTS.EXCEPTION, chat.chatException);
    chat.socket.on(WS_ENDPOINTS.DISCONNECT, chat.chatDisconnect);


    window.SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    let finalTranscript = '';
    let interimTranscript = '';
    let recognition = new window.SpeechRecognition();
    recognition.interimResults = true;
    recognition.maxAlternatives = 10;
    recognition.continuous = false;
    recognition.lang = "en-GB";
    recognition.onresult = (event) => {
        pressed = false;
        finalTranscript = '';
        interimTranscript = '';
        for (let i = event.resultIndex, len = event.results.length; i < len; i++) {
            let transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }
        console.log(`Final Transcript: ${finalTranscript} | Interim Transcript: ${interimTranscript}`);
    };
    let pressed = false;
    recognition.onaudioend = (event) => {
        pressed = false;
        if (!lStorage.has(lStorage.keys.USER)) {
            chat.socket.emit(WS_ENDPOINTS.INIT_USER_COVERTLY, {id: null});
        }
        console.log('Recognition stopped');
        recognition.stop();
        $('#audio_input').removeClass('recording');
        pressed = false;

        setTimeout(() => {
            if (finalTranscript !== '') {
                const messageDto = ModelFactory.messageDtoBuilderText(finalTranscript, SenderType.USER);
                chat.onRespond(messageDto);
                $('#widget_input_field').empty();
                finalTranscript = '';
            }
        }, 300);
    };

    $('#audio_input').on('click', chat.audioRecording);


    $('.show_buttons').on('click', function () {
        $(this).toggleClass('rotated');
        $('#mobile_buttons').toggleClass('expanded');
    });

    $(window).on('unload', () => {
        chat.setCookie('opened', 'false', {expires: chat.expires});
    });


    $('#test_linkedin').on('click', chat.linkedinGetAuthToken);
});
