import { motion } from "framer-motion";
import { BallBlue } from "@sd/assets/images";
import Orb from "../../components/Orb";
import { CircleButton } from "@spacedrive/primitives";
import { GithubLogo } from "@phosphor-icons/react";

export function AboutSettings() {

  return (
    <div className="flex flex-col items-center justify-center min-h-[600px]">
      {/* Animated orb with ball */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative w-64 h-64 mb-8"
      >
        {/* Ball image - behind the orb */}
        <div className="absolute inset-[8%] z-0">
          <img
            src={BallBlue}
            alt="Spacedrive"
            className="w-full h-full object-contain select-none"
            draggable={false}
          />
        </div>
        {/* Orb animation - inset to make it smaller */}
        <div className="absolute inset-[15%] z-10">
          <Orb
            palette="blue"
            hue={0}
            hoverIntensity={0}
            rotateOnHover={false}
            forceHoverState={true}
          />
        </div>
      </motion.div>

      {/* Branding */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="text-center mb-4"
      >
        <h3 className="text-2xl font-bold text-white mb-1">Spacedrive Minimalized</h3>
        <p className="text-sm text-accent-bright font-medium">
          v2.0.0-alpha.2 &bull; 99ebd26
        </p>
        <p className="text-xs text-white/50 mt-1">
          Fast, minimalized, and optimized file manager
        </p>
      </motion.div>

      {/* Description & Attribution */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
        className="max-w-md text-center mb-6 px-4"
      >
        <p className="text-xs text-white/60 leading-relaxed">
          Re-architected for instant live filesystem browsing without background catalog dependencies. Forked from Spacedrive with gratitude to Jamie Pine and the open-source community for the foundational work.
        </p>
      </motion.div>

      {/* Links */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="flex gap-3 mb-6"
      >
        <a
          href="https://github.com/kalabhaftu/spacedrive-minimalized"
          target="_blank"
          rel="noopener noreferrer"
        >
          <CircleButton icon={GithubLogo}>
            Source Code
          </CircleButton>
        </a>
      </motion.div>

      {/* License */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.45 }}
        className="text-center"
      >
        <span className="text-xs text-white/30">
          FSL-1.1-ALv2 License
        </span>
      </motion.div>
    </div>
  );
}
