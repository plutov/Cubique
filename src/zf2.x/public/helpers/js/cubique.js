/**
 * Cubique
 * @author    Alexander Plutov
 * @copyright (c) 2011-2012 Alexander Plutov
 * @link      https://github.com/plutov/cubique
 * @license   https://github.com/plutov/cubique/blob/master/LICENSE
 */

/**
 * Sets common variables, render grid, get data.
 * @param options object
 * @return void
 */
Cubique = function(options)
{
    $.extend(this, options);
    this.count        = 0;
    this.currPage     = 1;
    this.sort         = '';
    this.search       = {};
    this.searchValues = {};
    try {
        this.isLocalStorageAvailable = 'localStorage' in window && window['localStorage'] !== null;
    } catch (e) {
        this.isLocalStorageAvailable = false;
    }
    var perPagesOptions = [10, 25, 50, 100],
        rowsOnPageState = parseInt(this.getState('rowsOnPage')),
        currPageState   = parseInt(this.getState('currPage')),
        sortColumnState = this.getState('sortColumn'),
        sortOrderState  = this.getState('sortOrder'),
        l               = this,
        searchState     = $.parseJSON(l.getState('search'));
    perPagesOptions.push(this.rowsOnPage);
    perPagesOptions.sort(function(a,b){return a-b;});
    perPagesOptions.join();
    if (sortColumnState && sortOrderState) {
        this.sort = sortColumnState + ' ' + sortOrderState;
    }
    if (rowsOnPageState && $.inArray(rowsOnPageState, perPagesOptions) != -1) {
        this.rowsOnPage = rowsOnPageState;
        if (currPageState) {
            this.currPage = currPageState;
        }
    } else {
        this.setState('rowsOnPage', this.rowsOnPage);
        this.setState('currPage', this.currPage);
    }
    if (searchState) {
        this.search = searchState;
    }
    this.perPageOptions  = {};
    for (var j in perPagesOptions) {
        this.perPageOptions[perPagesOptions[j]] = perPagesOptions[j];
    }
    this.renderGrid();
    this.showData();
}

/**
 * Renders main grid HTML.
 * @return void
 */
Cubique.prototype.renderGrid = function Cubique_renderGrid()
{
    var html   = '<table class="cubique"><thead><tr>',
        column = '',
        sortColumnState = this.getState('sortColumn'),
        sortOrderState  = this.getState('sortOrder'),
        spanValue       = '',
        dataOrder       = 'ASC';
    for (var i in this.columns) {
        if (typeof(this.columnsToSort[i]) != 'undefined') {
            spanValue = (sortColumnState == this.columnsToSort[i]) ? (sortOrderState == 'ASC' ? '&#9660' : '&#9650') : '';
            dataOrder = (sortColumnState == this.columnsToSort[i]) ? (sortOrderState == 'ASC' ? 'DESC' : 'ASC') : 'ASC';
            column = '<span class="order">' + spanValue + '</span> <a href="#" title="Sort by ' + this.columns[i] + '" class="sort-by" data-column="' + i + '" data-order="' + dataOrder + '">' + this.columns[i] + '</a>';
        } else {
            column = this.columns[i];
        }
        html += '<th>' + column + '</th>';
    }
    html += '</tr>';
    if (this.getObjectSize(this.columnsToSearch)) {
        html += '<tr>';
        var searchValue = tempSearchType = '',
            conditions  = ['LIKE', 'NOT LIKE', '=', '<>', '<', '>', '<=', '>='];
        for (var j in this.columns) {
            column = '';
            if (typeof(this.columnsToSearch[j]) != 'undefined') {
                searchValue = (typeof(this.search[j]) != 'undefined') ? this.search[j][0] : '';
                tempSearchType = (typeof(this.search[j]) != 'undefined') ? this.search[j][1] : '';
                column += '<select class="search-type" title="Search type">';
                for (var k in conditions) {
                    column += '<option value="' + conditions[k] + '"' + (tempSearchType == '' + conditions[k] + '' ? ' selected=selected' : '') + '>' + conditions[k] + '</option>';
                }
                column += '</select>' +
                          '<input type="text" data-column="' + j + '" placeholder="search" value="' + searchValue + '"/> ' +
                          '<a href="#" class="reset-search" title="Reset search">&times;</a>';
                this.searchValues[j] = (typeof(this.search[j]) != 'undefined') ? this.search[j] : '';
            }
            html += '<th>' + column + '</th>';
        }
        html += '</tr>';
    }
    html += '</thead><tbody></tbody></table>';
    $('#cubique-' + this.name).html(html);
    var sortOrder  = 'ASC',
        sortColumn = '',
        l          = this,
        sortLinks  = $('#cubique-' + this.name + ' a.sort-by');
    sortLinks.click(function() {
        sortLinks.prev('span').html('');
        sortOrder      = $(this).attr('data-order');
        sortColumn     = $(this).attr('data-column');
        l.currPage = 1;
        l.sort     = sortColumn + ' ' + sortOrder;
        l.setState('currPage', 1);
        l.setState('sortColumn', sortColumn);
        l.setState('sortOrder', sortOrder);
        $(this).attr('data-order', sortOrder == 'ASC' ? 'DESC' : 'ASC');
        $(this).prev('span').html(sortOrder == 'ASC' ? '&#9660;' : '&#9650;');
        l.showData();
        return false;
    });
    $('#cubique-' + this.name + ' input').keyup(function() {
        l.makeSearch($(this), $(this).prev('select'));
        return false;
    });
    $('#cubique-' + this.name + ' .search-type').change(function() {
        l.makeSearch($(this).next('input'), $(this));
        return false;
    });
    $('#cubique-' + this.name + ' .reset-search').click(function() {
        var input  = $(this).prev(),
            select = input.prev();
        input.val(null);
        select.val('LIKE');
        l.makeSearch(input, select);
        return false;
    });
    this.tbody = $('#cubique-' + this.name + ' tbody');
    this.thead = $('#cubique-' + this.name + ' thead');
}

/**
 * Makes AJAX request to the server and display data.
 * @return void
 */
Cubique.prototype.showData = function Cubique_showData()
{
    var columnsCount    = this.getObjectSize(this.columns),
        loading         = $('<tr><td colspan="' + columnsCount + '" class="loading">.</td></tr>'),
        loadingInterval = setInterval(function() { $('.loading').html($('.loading').html() + '.'); }, 50),
        l    = this,
        date = new Date();
    this.tbody.html(loading);
    $.ajax({
        type: 'post',
        data: l.getPostData(),
        url: (l.url ? l.url : location.href) + '?nocache=' + date.getTime(),
        dataType: 'json',
        success:  function(response) {
            if (response.error) {
                l.tbody.html('<tr><td colspan="' + columnsCount + '" class="error">' + l.error_message + '</td></tr>');
            } else {
                l.count = response.count;
                var html = '';
                for (var rowKey in response.data) {
                    html += '<tr>';
                    for (var columnName in response.data[rowKey]) {
                        if (null == response.data[rowKey][columnName]) {
                            response.data[rowKey][columnName] = '';
                        }
                        html += '<td>' + response.data[rowKey][columnName] + '</td>';
                    }
                    html += '</tr>';
                }
                l.tbody.html(html);
                $('table.cubique tbody td').mouseover(function() {
                    $(this).parent().addClass('hovered');
                })
                .mouseleave(function() {
                    $(this).parent().removeClass('hovered');
                });
                l.thead.find('.pages').remove();
                l.renderPagesSection();
            }
            clearInterval(loadingInterval);
            loading.remove();
        }
    });
}

/**
 * Renders pages section.
 * @return void
 */
Cubique.prototype.renderPagesSection = function Cubique_renderPagesSection()
{
    var pages      = '',
        pagesCount = to = Math.ceil(this.count/this.rowsOnPage),
        from       = 1,
        moreSpan   = '<span class="more">...</span>';
    if (pagesCount > 10) {
        if (this.currPage <= 6) {
            from = 1;
            to   = 10;
        } else if (pagesCount - this.currPage <= 5) {
            from = pagesCount - 11;
            to   = pagesCount;
            pages += this.getGoToPageLink(1, false) + moreSpan;
        } else {
            from = this.currPage - 5;
            to   = (this.currPage + 5 <= pagesCount) ? this.currPage + 5 : pagesCount;
            pages += this.getGoToPageLink(1, false);
            if (this.currPage > 7) {
                pages += moreSpan;
            }
        }
    }
    for (var i = from; i <= to; i++) {
        pages += this.getGoToPageLink(i, i == this.currPage);
    }
    if (pagesCount > to) {
        if (pagesCount - this.currPage >= 7) {
            pages += moreSpan;
        }
        pages += this.getGoToPageLink(pagesCount, false);
    }
    var select = '<select class="per-page" title="Rows on page">';
    for (var j in this.perPageOptions) {
        select += '<option value="' + this.perPageOptions[j] + '">' + this.perPageOptions[j] + '</option>';
    }
    select += '</select>';
    this.thead.append($('<tr class="pages"><th colspan="' + this.getObjectSize(this.columns) + '">' + pages +
                        '<a href="#" class="csv" title="Export to CSV">csv</a>' +
                        '<a href="#" class="refresh" title="Refresh page">refresh</a>' + select + '<span class="in-total">' +
                        this.count + ' in total</span></th></tr>'));
    var l = this;
    this.thead.find('.go-to-page').click(function() {
        l.currPage = parseInt($(this).attr('data-number'));
        l.setState('currPage', l.currPage);
        l.showData();
        return false;
    });
    this.thead.find('.per-page').change(function() {
        l.rowsOnPage = $(this).val();
        l.setState('rowsOnPage', l.rowsOnPage);
        l.setState('currPage', 1);
        l.currPage   = 1;
        l.showData();
        return false;
    }).val(this.rowsOnPage);
    this.thead.find('.refresh').click(function() {
        l.showData();
        return false;
    });
    this.thead.find('.csv').click(function() {
        var data = l.stringify(l.getPostData());
        document.location.href = (l.url ? l.url : location.href) + '?cubique_data=' + encodeURIComponent(data);
        return false;
    });
}

/**
 * Returns go-to-page link.
 * @param pageNumber number
 * @param isCurrent bool
 * @return string
 */
Cubique.prototype.getGoToPageLink = function Cubique_getGoToPageLink(pageNumber, isCurrent)
{
    return '<a href="#" title="Go to page ' + pageNumber + '" class="go-to-page' + (isCurrent ? ' curr' : '') + '" data-number="' + pageNumber + '">' + pageNumber + '</a>'
}

/**
 * Get object size.
 * @param obj object
 * @return int
 */
Cubique.prototype.getObjectSize = function Cubique_getObjectSize(obj)
{
    var size = 0;
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            size++;
        }
    }
    return size;
}

/**
 * Sets search data and makes AJAX request.
 * @param value object
 * @param type object
 * @return void
 */
Cubique.prototype.makeSearch = function Cubique_makeSearch(value, type)
{
    var searchColumn = value.attr('data-column'),
        search       = [value.val(), type.val()];
    if (this.searchValues[searchColumn] != search) {
        this.search[searchColumn] = search;
        this.setState('currPage', 1);
        this.setState('search', this.stringify(this.search));
        this.searchValues[searchColumn]  = search;
        this.currPage = 1;
        this.showData();
    }
}

/**
 * Returns JSON string.
 * @param obj object
 * @return string
 */
Cubique.prototype.stringify = function Cubique_stringify(obj)
{
    if ('JSON' in window) {
        return JSON.stringify(obj);
    }

    var t = typeof (obj);
    if (t != 'object' || obj === null) {
        if (t == 'string') {
            obj = '"' + obj + '"';
        }
        return String(obj);
    } else {
        var n, v, json = [], arr = (obj && obj.constructor == Array);
        for (n in obj) {
            v = obj[n];
            t = typeof(v);
            if (obj.hasOwnProperty(n)) {
                if (t == 'string') {
                    v = '"' + v + '"';
                } else if (t == 'object' && v !== null) {
                    v = this.stringify(v);
                }

                json.push((arr ? "" : '"' + n + '":') + String(v));
            }
        }

        return (arr ? '[' : '{') + String(json) + (arr ? ']' : '}');
    }
}

/**
 * Returns key value from local storage or cookies.
 * @param key string
 * @return string
 */
Cubique.prototype.getState = function Cubique_getState(key)
{
    key = this.name + '_' + key;
    if (this.isLocalStorageAvailable) {
        return localStorage.getItem(key);
    } else {
        var cookie = ' ' + document.cookie,
            search = ' ' + key + '=',
            value = '',
            offset = end = 0;
        if (cookie.length > 0) {
            offset = cookie.indexOf(search);
            if (offset != -1) {
                offset += search.length;
                end = cookie.indexOf(';', offset);
                if (end == -1) {
                    end = cookie.length;
                }
                value = cookie.substring(offset, end);
            }
        }
        return(value);
    }
}

/**
 * Sets value of state in local storage or cookies.
 * @param key string
 * @param value string
 * @return void
 */
Cubique.prototype.setState = function Cubique_setState(key, value)
{
    key = this.name + '_' + key;
    if (this.isLocalStorageAvailable) {
        localStorage.setItem(key, value);
    } else {
        var now = expire = new Date();
        expire.setTime(now.getTime() + 864000000); // Just 10 days
        document.cookie = key + '=' + value + ';expires=' + expire.toGMTString() + ';path=/';
    }
}

/**
 * Returns data for AJAX or CSV export.
 * @return obj
 */
Cubique.prototype.getPostData = function Cubique_getPostData()
{
    return {
        cubique: {
            name:         this.name,
            curr_page:    this.currPage,
            sort:         this.sort,
            search:       this.search,
            rows_on_page: this.rowsOnPage
        }
    };
}