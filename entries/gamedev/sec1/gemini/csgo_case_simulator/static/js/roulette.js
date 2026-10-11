/**
 * CS:GO Case Opening Horizontal Roulette Reel & Unboxing Sequence
 */

class RouletteController {
    constructor() {
        this.container = document.getElementById('roulette-overlay');
        this.reelTrack = document.getElementById('roulette-track');
        this.unboxedModal = document.getElementById('unboxed-modal');
        this.isSpinning = false;
        this.cardWidth = 190; // width + margin
        this.activeResult = null;
    }

    startSpin(openResult, onComplete) {
        if (this.isSpinning) return;
        this.isSpinning = true;
        this.activeResult = openResult;

        const { reel, winner_index, won_skin } = openResult;

        // Render cards into reel track
        this.reelTrack.innerHTML = '';
        reel.forEach((skin, idx) => {
            const card = this.createCardElement(skin, idx);
            this.reelTrack.appendChild(card);
        });

        // Reset track position to beginning
        this.reelTrack.style.transition = 'none';
        this.reelTrack.style.transform = 'translateX(0px)';

        // Show overlay
        this.container.classList.remove('hidden');

        // Play unboxing latch pop
        window.soundEngine.playUnlock();

        // Calculate target translation
        // Center line is at container.clientWidth / 2
        // Winning card index is winner_index (usually 38)
        // Add slight random offset (-60 to +60 px) inside the 190px card
        const viewportCenter = this.container.clientWidth / 2;
        const randomCardOffset = (Math.random() - 0.5) * 110;
        const targetX = -(winner_index * this.cardWidth + (this.cardWidth / 2) - viewportCenter + randomCardOffset);

        // Force browser layout reflow
        void this.reelTrack.offsetWidth;

        // Animate with custom easing and audio tick tracking
        const spinDuration = 5800; // ms
        const startTime = performance.now();
        let lastTickIndex = -1;

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(1, elapsed / spinDuration);

            // CS:GO ease-out quint / expo curve
            const ease = 1 - Math.pow(1 - progress, 5);
            const currentX = targetX * ease;

            this.reelTrack.style.transform = `translateX(${currentX}px)`;

            // Calculate which card is currently passing the center line
            const currentCenterCard = Math.floor((-currentX + viewportCenter) / this.cardWidth);
            if (currentCenterCard !== lastTickIndex && currentCenterCard >= 0 && currentCenterCard < reel.length) {
                lastTickIndex = currentCenterCard;
                // Pitch variation as wheel slows down
                const pitch = Math.max(0.6, 1.2 - progress * 0.5);
                window.soundEngine.playTick(pitch);
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Spin finished!
                this.isSpinning = false;
                setTimeout(() => {
                    this.finishSpin(openResult, onComplete);
                }, 400);
            }
        };

        requestAnimationFrame(animate);
    }

    createCardElement(skin, idx) {
        const card = document.createElement('div');
        card.className = `roulette-card rarity-${skin.rarity.toLowerCase()}`;
        card.dataset.index = idx;

        const rarityColor = this.getRarityColor(skin.rarity);
        card.style.borderColor = rarityColor;

        card.innerHTML = `
            <div class="card-glow" style="background: radial-gradient(circle, ${rarityColor}33 0%, transparent 70%);"></div>
            <div class="card-weapon-type">${skin.weapon_label}</div>
            <div class="card-skin-name" style="color: ${rarityColor}">${skin.name}</div>
            <div class="card-preview">
                <div class="weapon-silhouette" style="border-bottom: 3px solid ${rarityColor}">
                    <span class="weapon-tag">${skin.category}</span>
                </div>
            </div>
            <div class="card-rarity-strip" style="background: ${rarityColor}"></div>
        `;
        return card;
    }

    getRarityColor(rarity) {
        switch (rarity) {
            case 'Common': return '#4b69ff'; // Mil-spec blue
            case 'Rare': return '#8847ff';   // Restricted purple
            case 'Epic': return '#d32ce6';   // Classified pink
            case 'Legendary': return '#eb4b4b'; // Covert red
            default: return '#5e98d9';
        }
    }

    finishSpin(result, onComplete) {
        // Play victory sound
        window.soundEngine.playRarityReveal(result.won_skin.rarity);

        // Show Unboxed Item Modal
        this.showUnboxedModal(result);

        if (onComplete) onComplete(result);
    }

    showUnboxedModal(result) {
        const { won_skin, condition, float_value, value, inventory_id } = result;
        const rarityCol = this.getRarityColor(won_skin.rarity);

        document.getElementById('unboxed-weapon-name').textContent = won_skin.weapon_label;
        document.getElementById('unboxed-skin-name').textContent = won_skin.name;
        document.getElementById('unboxed-skin-name').style.color = rarityCol;
        document.getElementById('unboxed-rarity').textContent = `${won_skin.rarity.toUpperCase()} GRADE`;
        document.getElementById('unboxed-rarity').style.color = rarityCol;
        document.getElementById('unboxed-condition').textContent = `${condition} (Float: ${float_value.toFixed(4)})`;
        document.getElementById('unboxed-value').textContent = `$${value.toFixed(2)}`;
        
        const cardBox = document.getElementById('unboxed-card-box');
        cardBox.style.borderColor = rarityCol;
        cardBox.style.boxShadow = `0 0 30px ${rarityCol}66`;

        // Configure modal action buttons
        const sellBtn = document.getElementById('unboxed-sell-btn');
        sellBtn.textContent = `Sell for $${value.toFixed(2)}`;
        sellBtn.onclick = () => {
            window.app.sellItem(inventory_id, () => {
                this.closeUnboxedModal();
            });
        };

        const inspectBtn = document.getElementById('unboxed-inspect-btn');
        inspectBtn.onclick = () => {
            this.closeUnboxedModal();
            window.app.inspectWeapon(won_skin, condition);
        };

        const closeBtn = document.getElementById('unboxed-close-btn');
        closeBtn.onclick = () => {
            this.closeUnboxedModal();
        };

        this.unboxedModal.classList.remove('hidden');

        // Confetti for Epic and Legendary
        if (won_skin.rarity === 'Legendary' || won_skin.rarity === 'Epic') {
            this.triggerConfetti(rarityCol);
        }
    }

    closeUnboxedModal() {
        this.unboxedModal.classList.add('hidden');
        this.container.classList.add('hidden');
    }

    triggerConfetti(primaryColor) {
        if (window.confetti) {
            window.confetti({
                particleCount: 100,
                spread: 80,
                origin: { y: 0.6 },
                colors: [primaryColor, '#ffd700', '#ffffff'],
            });
        }
    }
}

window.rouletteController = new RouletteController();
