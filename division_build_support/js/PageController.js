(function ($) {
    'use strict';

    // =========================
    // 画面ロジック
    // =========================
    var pageLogic = {

        __name: 'division_build_support.logic.PageLogic',

        getArmorTalentData: function () {
            var dfd = h5.async.deferred();

            var mask = h5.ajax('./csv/armor_talent-mask.csv');
            var body = h5.ajax('./csv/armor_talent-body.csv');
            var backpack = h5.ajax('./csv/armor_talent-backpack.csv');
            var glove = h5.ajax('./csv/armor_talent-glove.csv');
            var knee = h5.ajax('./csv/armor_talent-knee.csv');
            var holster = h5.ajax('./csv/armor_talent-holster.csv');

            $.when(mask, body, backpack, glove, knee, holster).then(
                function (maskRes, bodyRes, backpackRes, gloveRes, kneeRes, holsterRes) {
                    dfd.resolve({
                        body: bodyRes[0],
                        backpack: backpackRes[0],
                        mask: maskRes[0],
                        glove: gloveRes[0],
                        knee: kneeRes[0],
                        holster: holsterRes[0]
                    });
                },
                function () {
                    throw new Error('error: getArmorTalentData');
                }
            );

            return dfd.promise();
        },

        getSetBounusData: function () {
            return h5.ajax('./csv/armor_talent-setbounus.csv');
        }
    };

    var manager = h5.core.data.createManager('divisionArmor');
    var armorTalentModel = manager.createModel({
        name: 'divisionArmorModel',
        schema: {
            id: { id: true },
            name: { type: 'string' }
        }
    });
    var SET_NAME_MAP = {
        d3fnc: 'D3-FNC',
        banshee: 'バンシー',
        firecrest: 'ファイアークレスト',
        reclaimer: 'リクレーマー',
        deadeye: 'デッドアイ',
        alphabridge: 'アルファブリッジ',
        hunters: 'ハンターズクリード',
        final: 'ファイナルメジャー',
        predator: 'プレデターマーク',
        lonestar: 'ローンスター',
        striker: 'ストライカー',
        sentry: 'セントリーコール',
        tactisian: 'タクティシャン',
        nomad: 'ノーマッド'
    };

    var errAlert = function () {
        alert('想定外のエラー');
    };

    // =========================
    // 画面コントローラ
    // =========================
    var pageController = {

        __name: 'division_build_support.controller.PageController',

        _logic: pageLogic,
        _setBounusList: h5.core.data.createObservableArray(),
        _selectedSetMap: {
            mask: null,
            body: null,
            backpack: null,
            glove: null,
            knee: null,
            holster: null
        },

        __init: function () {
            this._logic.getArmorTalentData().done(this.own(function (armorTalentDataRes) {
                this._armorTalentData = this._convertResToArmorTalentData(armorTalentDataRes);
                console.log(this._armorTalentData);

                h5.core.view.bind('.armorTalentContainer', {
                    armorItems: this._armorTalentData
                });
            }));

            this._logic.getSetBounusData().done(this.own(function (setBounusDataRes) {
                this._setBounusData = this._convertResToSetBounusData(setBounusDataRes);
                console.log(this._setBounusData);

                h5.core.view.bind('.setBounusContainer', {
                    setBounusList: this._setBounusList
                });
            }));
        },

        /**
         * 防具タレントのデータを表示用データに変換
         */
        _convertResToArmorTalentData: function (res) {
            // returnするデータの型
            // [{
            //     partName: 'mask',
            //     data: [
            //         { name: 'エンデュアリング', setName: '' },
            //         { name: 'D3-FNC', setName: 'd3fnc' }
            //     ]
            // }]
            var result = h5.core.data.createObservableArray();

            var keys = Object.keys(res);
            keys.forEach(function (key) {
                var partDataAry = h5.core.data.createObservableArray();
                var strAry = res[key].split(/\r\n|\r|\n/);// 各要素が'name,desc'の配列
                strAry.forEach(function (str) {
                    var ary = str.split(',');
                    partDataAry.push({
                        name: ary[0],
                        desc: ary[1],
                        setName: ary[2]
                    });
                });

                result.push({
                    partName: key,
                    data: partDataAry
                });
            });

            return result;
        },

        /**
         * セット効果のデータをキャッシュする型に変換
         */
        _convertResToSetBounusData: function (res) {
            // retusnするデータの型
            // {
            //     d3fnc: {
            //         name: 'D3-FNC',
            //         desc: {
            //             '2': 'xxx',
            //             '3': 'yyy',
            //             ...
            //         }
            //     },
            //     ...
            // }
            var result = {};

            // 各要素は１セット分の文字列。先頭の要素はヘッダ部分なので除外。最後の要素はsplitによる空行なので除外
            var rowAry = res.split(/@@@/).slice(1, -1);

            rowAry.forEach(function (rowStr) {
                var ary = rowStr.split(',');
                result[ary[0].slice(2)] = {
                    name: ary[2],
                    desc: {
                        '2': ary[3],
                        '3': ary[4],
                        '4': ary[5],
                        '5': ary[6],
                        '6': ary[7]
                    }
                }
            });

            return result;
        },

        '.armorTalentList change': function (context, $el) {
            this._updateArmorTalentDesc($el);// 選択したarmorのdescに表示を更新する
            this._updateSetArmorMap($el);// setArmorのマップを更新
            this._updateSetBounus();// setArmorの選択状態からbounus表示欄を更新
        },

        _updateArmorTalentDesc: function ($list) {
            var desc = this._getArmorTalentDesc($list);// talentのdescを取得
            var descArea = $list.next('.talentDescArea')[0];
            descArea.innerText = desc;
        },

        _getArmorTalentDesc: function ($list) {
            var option = $list[0].selectedOptions[0];
            var desc = option.attributes.desc.nodeValue;
            return desc;
        },

        // _getArmorDataIdx: function (armorName, talentName) {
        //     var armorItems = this._armorTalentData[armorName];
        //     var idx = -1;
        //     for (var i = 0, len = armorItems.length; i < len; i++) {
        //         if (armorItems[i].talentName === talentName) {
        //             idx = i;
        //             break;
        //         }
        //     }
        //     return idx;
        // },

        _updateSetArmorMap: function ($list) {
            var $option = $($list[0].selectedOptions[0]);
            var setName = $option.data('setName');
            var partName = $list.prev('.partName').text();
            this._selectedSetMap[partName] = setName;
        },

        _updateSetBounus: function () {
            this._setBounusList.splice(0, this._setBounusList.length);
            var selectSetList = {};
            $.each(this._selectedSetMap, this.own(function (key, setName) {
                if (setName == null || setName === '') {
                    return;
                }
                selectSetList[setName] = selectSetList[setName] == null ? 1 : ++selectSetList[setName];
            }));

            $.each(selectSetList, this.own(function (setName, cnt) {
                if (cnt < 2) {
                    return;
                }
                if (5 < cnt) {
                    cnt = 4;
                }
                var desc = this._setBounusData[setName].desc[cnt];
                this._setBounusList.push({
                    setNum: SET_NAME_MAP[setName] + ' ' + cnt + 'セット効果：',
                    setDesc: desc
                });
            }));
        }
    };

    // ===============
    // 外部公開
    // ===============
    $(function () {
        window.c = h5.core.controller('body', pageController);
    });

})(jQuery);