// Global State & Data
let songs = [];
let inNewFolderView = false;

// DOM Elements
const songsList = document.getElementById('songs-list');
const songCount = document.getElementById('song-count');
const listHeader = document.getElementById('list-header');
const searchInput = document.getElementById('search-input');

const addSongBtn = document.getElementById('add-song-btn');
const songModal = document.getElementById('song-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const songForm = document.getElementById('song-form');

const detailsModal = document.getElementById('details-modal');
const closeDetailsBtn = document.getElementById('close-details-btn');
const detailsContent = document.getElementById('details-modal-content');

// Helper to extract YouTube Embed ID
function extractYouTubeID(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Fetch Songs from Supabase
async function fetchSongs() {
    try {
        const { data, error } = await supabaseClient
            .from('songs')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        songs = data || [];
        updateUnapprovedBadge();
        
        if (inNewFolderView) {
            showNewSongsFolder();
        } else {
            renderSongs(songs, "All Songs");
        }
    } catch (err) {
        console.error('Error fetching songs:', err.message);
        if (songsList) {
            songsList.innerHTML = `<div class="text-center py-8 text-rose-400 text-sm">Failed to load songs. Please refresh.</div>`;
        }
    }
}

// Render Songs as Compact List
function renderSongs(songsToRender, titleText = "All Songs") {
    if (listHeader) listHeader.textContent = titleText;
    if (songCount) songCount.textContent = `${songsToRender.length} song${songsToRender.length !== 1 ? 's' : ''} found`;
    if (!songsList) return;

    let sortedSongs = [...songsToRender];
    if (inNewFolderView) {
        sortedSongs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else {
        sortedSongs.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }

    songsList.innerHTML = '';

    if (sortedSongs.length === 0) {
        songsList.innerHTML = `<div class="text-center py-8 text-slate-500 text-sm">No songs found</div>`;
        return;
    }

    sortedSongs.forEach(song => {
        const item = document.createElement('div');
        item.className = 'bg-slate-800 border border-slate-700/80 hover:border-indigo-500/50 rounded-xl p-3.5 flex items-center justify-between cursor-pointer transition shadow-sm hover:bg-slate-700/50 mb-2';
        
        item.innerHTML = `
            <div class="flex items-center space-x-3 overflow-hidden">
                <div class="w-8 h-8 rounded-lg ${song.is_approved === false ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-600/20 text-indigo-400'} flex items-center justify-center font-bold text-xs shrink-0">
                    <i class="fa-solid ${song.is_approved === false ? 'fa-clock' : 'fa-music'}"></i>
                </div>
                <div class="truncate">
                    <h3 class="font-bold text-sm text-slate-100 truncate">${song.title}</h3>
                    <span class="inline-block text-[10px] font-semibold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full mt-0.5">${song.category || 'Others'}</span>
                </div>
            </div>
            <i class="fa-solid fa-chevron-right text-slate-500 text-xs pl-2"></i>
        `;

        item.addEventListener('click', () => openSongDetails(song));
        songsList.appendChild(item);
    });
}

// Open Details Popup Modal
function openSongDetails(song) {
    if (!detailsModal || !detailsContent) return;

    let videoEmbed = '';
    const ytId = extractYouTubeID(song.video_url);
    if (ytId) {
        videoEmbed = `<iframe class="w-full aspect-video rounded-xl mt-3 border border-slate-700" src="https://www.youtube.com/embed/${ytId}" allowfullscreen></iframe>`;
    }

    detailsContent.innerHTML = `
        <div class="space-y-3">
            <div class="flex items-center justify-between">
                <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">${song.category || 'Others'}</span>
                ${song.is_approved === false ? '<span class="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">Pending Approval</span>' : ''}
            </div>
            <h2 class="text-xl font-extrabold text-white leading-tight pt-1">${song.title}</h2>
            
            <div class="flex items-center gap-2 pt-1 flex-wrap">
                ${song.audio_url ? `<a href="${song.audio_url}" target="_blank" class="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"><i class="fa-solid fa-play"></i> Play Audio</a>` : ''}
                <button onclick="editSong('${song.id}')" class="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"><i class="fa-solid fa-pen"></i> Edit</button>
                <button onclick="toggleApproval('${song.id}')" class="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"><i class="fa-solid fa-thumbs-up"></i> ${song.is_approved === false ? 'Approve' : 'Approved'}</button>
            </div>

            ${videoEmbed}

            ${song.lyrics ? `
                <div class="pt-2">
                    <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Lyrics</h4>
                    <div class="bg-slate-900 border border-slate-700/60 p-3 rounded-xl text-xs font-mono whitespace-pre-line text-slate-200 leading-relaxed max-h-60 overflow-y-auto">${song.lyrics}</div>
                </div>
            ` : ''}
        </div>
    `;

    detailsModal.classList.remove('hidden');
}

// Approval Badge Counter
function updateUnapprovedBadge() {
    const badge = document.getElementById('new-count-badge');
    if (!badge) return;
    const unapproved = songs.filter(s => s.is_approved === false);
    badge.textContent = unapproved.length;
}

// Category Filter
function filterByCategory(cat) {
    inNewFolderView = false;
    const filtered = songs.filter(s => s.category && s.category.toLowerCase() === cat.toLowerCase());
    renderSongs(filtered, `${cat} Songs`);
}

// Show New / Unapproved Songs
function showNewSongsFolder() {
    inNewFolderView = true;
    const unapproved = songs.filter(s => s.is_approved === false);
    renderSongs(unapproved, "New Songs Folder");
}

// Edit Song Handler
function editSong(songId) {
    const song = songs.find(s => s.id === songId);
    if (!song) return;

    if (detailsModal) detailsModal.classList.add('hidden');

    document.getElementById('song-id').value = song.id;
    document.getElementById('song-title').value = song.title || '';
    document.getElementById('song-category').value = song.category || 'Opening';
    document.getElementById('song-lyrics').value = song.lyrics || '';
    document.getElementById('song-video-url').value = song.video_url || '';
    document.getElementById('song-audio-url').value = song.audio_url || '';

    const modalTitle = document.getElementById('modal-title');
    if (modalTitle) modalTitle.textContent = "Edit Song";

    if (songModal) songModal.classList.remove('hidden');
}

// Toggle Approval State in Supabase
async function toggleApproval(songId) {
    const song = songs.find(s => s.id === songId);
    if (!song) return;

    const updatedState = !song.is_approved;
    try {
        const { error } = await supabaseClient
            .from('songs')
            .update({ is_approved: updatedState })
            .eq('id', songId);

        if (error) throw error;

        song.is_approved = updatedState;
        updateUnapprovedBadge();
        openSongDetails(song);
        renderSongs(songs, listHeader ? listHeader.textContent : "All Songs");
    } catch (err) {
        alert("Failed to update approval status: " + err.message);
    }
}

// Event Listeners Initialization
document.addEventListener('DOMContentLoaded', () => {
    fetchSongs();

    // Add Song Modal Controls
    if (addSongBtn) {
        addSongBtn.addEventListener('click', () => {
            if (songForm) songForm.reset();
            const songIdField = document.getElementById('song-id');
            if (songIdField) songIdField.value = '';
            
            const modalTitle = document.getElementById('modal-title');
            if (modalTitle) modalTitle.textContent = "Add New Song";
            
            if (songModal) songModal.classList.remove('hidden');
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            if (songModal) songModal.classList.add('hidden');
        });
    }

    // Details Modal Controls
    if (closeDetailsBtn) {
        closeDetailsBtn.addEventListener('click', () => {
            if (detailsModal) detailsModal.classList.add('hidden');
        });
    }

    if (detailsModal) {
        detailsModal.addEventListener('click', (e) => {
            if (e.target === detailsModal) {
                detailsModal.classList.add('hidden');
            }
        });
    }

    // Search Input Logic
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = songs.filter(s => 
                (s.title && s.title.toLowerCase().includes(query)) ||
                (s.lyrics && s.lyrics.toLowerCase().includes(query))
            );
            renderSongs(filtered, query ? "Search Results" : "All Songs");
        });
    }

    // Song Submit (Add / Edit) Form Handler
    if (songForm) {
        songForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const id = document.getElementById('song-id').value;
            const title = document.getElementById('song-title').value;
            const category = document.getElementById('song-category').value;
            const lyrics = document.getElementById('song-lyrics').value;
            const video_url = document.getElementById('song-video-url').value;
            const audio_url = document.getElementById('song-audio-url').value;

            const payload = { title, category, lyrics, video_url, audio_url };

            try {
                if (id) {
                    // Update existing song
                    const { error } = await supabaseClient.from('songs').update(payload).eq('id', id);
                    if (error) throw error;
                } else {
                    // Create new song
                    payload.is_approved = true;
                    const { error } = await supabaseClient.from('songs').insert([payload]);
                    if (error) throw error;
                }

                if (songModal) songModal.classList.add('hidden');
                fetchSongs();
            } catch (err) {
                alert("Error saving song: " + err.message);
            }
        });
    }
});
